"""
Layer Profiler

Registers PyTorch forward hooks on transformer model components to capture
timing and activation statistics during inference.

Hooks are registered on:
- Attention components: q_proj, k_proj, v_proj, o_proj
- MLP components: gate_proj, up_proj, down_proj
- Layer normalizations: input_layernorm, post_attention_layernorm

Usage:
    profiler = LayerProfiler(model)
    profiler.register_hooks()

    # Run inference...

    timings = profiler.get_timings()
    profiler.detach()
"""

import time
import logging
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field

from .model_detector import ModelArchitectureDetector, ComponentPaths

logger = logging.getLogger(__name__)


@dataclass
class ComponentTiming:
    """Timing and statistics for a single component forward pass."""
    component_name: str
    layer_idx: int
    start_time: float
    end_time: float
    duration_ms: float

    # Activation statistics (captured from output)
    activation_mean: Optional[float] = None
    activation_std: Optional[float] = None
    activation_max: Optional[float] = None
    activation_sparsity: Optional[float] = None  # Fraction of near-zero values


class LayerProfiler:
    """
    Profiles transformer model layers by registering PyTorch forward hooks.

    Captures timing and activation statistics for each component during inference.
    """

    def __init__(
        self,
        model: Any,
        capture_activations: bool = True,
        sparsity_threshold: float = 1e-4
    ):
        """
        Initialize LayerProfiler.

        Args:
            model: PyTorch model to profile (HuggingFace transformers model)
            capture_activations: Whether to capture activation statistics
            sparsity_threshold: Threshold for considering activation as zero
        """
        self.model = model
        self.capture_activations = capture_activations
        self.sparsity_threshold = sparsity_threshold

        # Detect model architecture
        detector = ModelArchitectureDetector(model)
        self.component_paths: ComponentPaths = detector.detect()

        logger.info(f"Initialized LayerProfiler for {self.component_paths}")

        # Storage for hook handles and timings
        self.hook_handles: List[Any] = []
        self.timings: List[ComponentTiming] = []

        # Flag to track if hooks are registered
        self._hooks_registered = False

    def register_hooks(self) -> None:
        """
        Register forward hooks on all model components.

        This must be called before running inference to capture profiling data.
        """
        if self._hooks_registered:
            logger.warning("Hooks already registered, skipping")
            return

        logger.info(f"Registering hooks on {self.component_paths.num_layers} layers")

        # Get layers from model
        layers = self._get_layers()

        if not layers:
            raise ValueError(f"Could not access layers at path: {self.component_paths.layers_path}")

        # Register hooks on each layer
        for layer_idx, layer in enumerate(layers):
            self._register_layer_hooks(layer, layer_idx)

        self._hooks_registered = True
        logger.info(f"Registered {len(self.hook_handles)} hooks total")

    def _get_layers(self) -> Optional[Any]:
        """Get layers from model using detected path."""
        parts = self.component_paths.layers_path.split('.')
        obj = self.model

        for part in parts:
            if hasattr(obj, part):
                obj = getattr(obj, part)
            else:
                logger.error(f"Could not access attribute '{part}' in path {self.component_paths.layers_path}")
                return None

        return obj

    def _register_layer_hooks(self, layer: Any, layer_idx: int) -> None:
        """
        Register hooks on all components within a single layer.

        Args:
            layer: The transformer layer module
            layer_idx: Index of the layer (0-based)
        """
        # Register attention hooks
        self._register_component_hook(layer, layer_idx, self.component_paths.q_proj, "q_proj")
        self._register_component_hook(layer, layer_idx, self.component_paths.k_proj, "k_proj")
        self._register_component_hook(layer, layer_idx, self.component_paths.v_proj, "v_proj")
        self._register_component_hook(layer, layer_idx, self.component_paths.o_proj, "o_proj")

        # Register MLP hooks
        if self.component_paths.gate_proj:
            self._register_component_hook(layer, layer_idx, self.component_paths.gate_proj, "gate_proj")
        self._register_component_hook(layer, layer_idx, self.component_paths.up_proj, "up_proj")
        self._register_component_hook(layer, layer_idx, self.component_paths.down_proj, "down_proj")

        # Register layer norm hooks
        self._register_component_hook(layer, layer_idx, self.component_paths.input_layernorm, "input_layernorm")
        self._register_component_hook(layer, layer_idx, self.component_paths.post_attention_layernorm, "post_attention_layernorm")

    def _register_component_hook(
        self,
        layer: Any,
        layer_idx: int,
        component_path: str,
        component_name: str
    ) -> None:
        """
        Register a forward hook on a specific component.

        Args:
            layer: The transformer layer containing the component
            layer_idx: Index of the layer
            component_path: Dot-separated path to component (e.g., "self_attn.q_proj")
            component_name: Human-readable component name for logging
        """
        # Navigate to component
        parts = component_path.split('.')
        component = layer

        for part in parts:
            if hasattr(component, part):
                component = getattr(component, part)
            else:
                logger.warning(
                    f"Could not find component '{component_path}' in layer {layer_idx}, skipping"
                )
                return

        # Create pre-hook to capture start time
        def pre_hook(module, input):
            """Pre-hook to record start time."""
            # Store start time in module for retrieval in post-hook
            module._profiler_start_time = time.perf_counter()

        # Create post-hook to capture end time and statistics
        def post_hook(module, input, output):
            """Post-hook to record end time and capture statistics."""
            end_time = time.perf_counter()
            start_time = getattr(module, '_profiler_start_time', end_time)
            duration_ms = (end_time - start_time) * 1000.0

            # Create timing record
            timing = ComponentTiming(
                component_name=component_name,
                layer_idx=layer_idx,
                start_time=start_time,
                end_time=end_time,
                duration_ms=duration_ms
            )

            # Capture activation statistics if enabled
            if self.capture_activations and output is not None:
                try:
                    import torch

                    # Handle tuple outputs (some modules return multiple values)
                    if isinstance(output, tuple):
                        output_tensor = output[0]
                    else:
                        output_tensor = output

                    # Ensure we're working with a tensor
                    if isinstance(output_tensor, torch.Tensor):
                        # Use torch.mps.synchronize() on Apple Silicon for accurate timing
                        if output_tensor.device.type == 'mps':
                            torch.mps.synchronize()

                        # Compute statistics
                        timing.activation_mean = output_tensor.abs().mean().item()
                        timing.activation_std = output_tensor.std().item()
                        timing.activation_max = output_tensor.abs().max().item()

                        # Compute sparsity (fraction of near-zero values)
                        near_zero = (output_tensor.abs() < self.sparsity_threshold).float()
                        timing.activation_sparsity = near_zero.mean().item()

                except Exception as e:
                    logger.debug(f"Could not capture activation stats for {component_name}: {e}")

            # Store timing
            self.timings.append(timing)

        # Register both hooks
        pre_handle = component.register_forward_pre_hook(pre_hook)
        post_handle = component.register_forward_hook(post_hook)

        # Store handles for later removal
        self.hook_handles.append(pre_handle)
        self.hook_handles.append(post_handle)

    def get_timings(self) -> List[ComponentTiming]:
        """
        Get all captured timings.

        Returns:
            List of ComponentTiming objects
        """
        return self.timings.copy()

    def reset(self) -> None:
        """
        Clear all captured timings.

        Call this between tokens or inference runs to start fresh.
        """
        self.timings.clear()

    def detach(self) -> None:
        """
        Remove all hooks from the model.

        Call this when profiling is complete to clean up.
        """
        logger.info(f"Removing {len(self.hook_handles)} hooks")

        for handle in self.hook_handles:
            handle.remove()

        self.hook_handles.clear()
        self._hooks_registered = False

    def __enter__(self):
        """Context manager entry - register hooks."""
        self.register_hooks()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - remove hooks."""
        self.detach()
        return False  # Don't suppress exceptions
