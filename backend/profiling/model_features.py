"""
Model Architecture Feature Extraction for Energy Analysis.

This module extracts architectural features from transformer models that significantly
impact energy consumption, inspired by Caravaca et al. 2025 "From Prompts to Power".

Key insight: Model structure impacts energy beyond parameter count alone.
"""

from dataclasses import dataclass
from typing import Dict, Any, Optional
import torch


@dataclass
class ModelFeatures:
    """Architectural features extracted from a transformer model."""

    # Basic architecture parameters
    num_layers: int
    hidden_size: int  # Model dimension (d_model)
    intermediate_size: int  # FFN dimension
    num_attention_heads: int
    num_key_value_heads: Optional[int]  # For GQA/MQA detection

    # Parameter counts
    total_params: int
    embedding_params: int
    attention_params_per_layer: int
    ffn_params_per_layer: int

    # Architecture type detection
    attention_mechanism: str  # "MHA", "GQA", or "MQA"
    is_moe: bool  # Mixture of Experts detection

    # Model metadata
    model_name: str
    architecture_type: str  # "llama", "mistral", "phi", "qwen", etc.

    # Derived metrics
    attention_to_ffn_ratio: float  # Ratio of attention params to FFN params
    params_per_layer: int

    def to_dict(self) -> Dict[str, Any]:
        """Convert features to dictionary for storage."""
        return {
            "num_layers": self.num_layers,
            "hidden_size": self.hidden_size,
            "intermediate_size": self.intermediate_size,
            "num_attention_heads": self.num_attention_heads,
            "num_key_value_heads": self.num_key_value_heads,
            "total_params": self.total_params,
            "embedding_params": self.embedding_params,
            "attention_params_per_layer": self.attention_params_per_layer,
            "ffn_params_per_layer": self.ffn_params_per_layer,
            "attention_mechanism": self.attention_mechanism,
            "is_moe": self.is_moe,
            "model_name": self.model_name,
            "architecture_type": self.architecture_type,
            "attention_to_ffn_ratio": self.attention_to_ffn_ratio,
            "params_per_layer": self.params_per_layer,
        }


def extract_model_features(model: torch.nn.Module, model_name: str = "unknown") -> ModelFeatures:
    """
    Extract architectural features from a transformer model.

    Args:
        model: PyTorch model (usually a HuggingFace transformers model)
        model_name: Name/identifier of the model

    Returns:
        ModelFeatures dataclass with extracted features
    """
    config = model.config

    # Extract basic architecture parameters
    num_layers = getattr(config, "num_hidden_layers", 0)
    hidden_size = getattr(config, "hidden_size", 0)
    intermediate_size = getattr(config, "intermediate_size", 0)
    num_attention_heads = getattr(config, "num_attention_heads", 0)
    num_key_value_heads = getattr(config, "num_key_value_heads", None)

    # Detect architecture type
    architecture_type = _detect_architecture_type(config)

    # Detect attention mechanism type
    if num_key_value_heads is None:
        attention_mechanism = "MHA"  # Multi-Head Attention
    elif num_key_value_heads == 1:
        attention_mechanism = "MQA"  # Multi-Query Attention
    elif num_key_value_heads < num_attention_heads:
        attention_mechanism = "GQA"  # Grouped-Query Attention
    else:
        attention_mechanism = "MHA"

    # Detect if model is Mixture of Experts
    is_moe = _detect_moe(model, config)

    # Count parameters
    total_params = sum(p.numel() for p in model.parameters())
    embedding_params = _count_embedding_params(model)
    attention_params_per_layer = _count_attention_params_per_layer(config, hidden_size, num_attention_heads, num_key_value_heads)
    ffn_params_per_layer = _count_ffn_params_per_layer(hidden_size, intermediate_size)

    # Calculate derived metrics
    params_per_layer = attention_params_per_layer + ffn_params_per_layer
    attention_to_ffn_ratio = attention_params_per_layer / ffn_params_per_layer if ffn_params_per_layer > 0 else 0.0

    return ModelFeatures(
        num_layers=num_layers,
        hidden_size=hidden_size,
        intermediate_size=intermediate_size,
        num_attention_heads=num_attention_heads,
        num_key_value_heads=num_key_value_heads,
        total_params=total_params,
        embedding_params=embedding_params,
        attention_params_per_layer=attention_params_per_layer,
        ffn_params_per_layer=ffn_params_per_layer,
        attention_mechanism=attention_mechanism,
        is_moe=is_moe,
        model_name=model_name,
        architecture_type=architecture_type,
        attention_to_ffn_ratio=attention_to_ffn_ratio,
        params_per_layer=params_per_layer,
    )


def _detect_architecture_type(config) -> str:
    """Detect the architecture type from config."""
    model_type = getattr(config, "model_type", "unknown")

    # Common architecture types
    architecture_map = {
        "llama": "llama",
        "mistral": "mistral",
        "phi": "phi",
        "phi3": "phi",
        "qwen": "qwen",
        "qwen2": "qwen",
        "gpt2": "gpt2",
        "gpt_neox": "gpt-neox",
        "opt": "opt",
        "bloom": "bloom",
    }

    return architecture_map.get(model_type, model_type)


def _detect_moe(model: torch.nn.Module, config) -> bool:
    """Detect if the model uses Mixture of Experts."""
    # Check for MoE-specific config attributes
    if hasattr(config, "num_local_experts") or hasattr(config, "num_experts"):
        return True

    # Check for MoE in module names
    for name, module in model.named_modules():
        if "moe" in name.lower() or "expert" in name.lower():
            return True

    return False


def _count_embedding_params(model: torch.nn.Module) -> int:
    """Count parameters in embedding layers."""
    embedding_params = 0

    for name, module in model.named_modules():
        if "embed" in name.lower():
            embedding_params += sum(p.numel() for p in module.parameters())

    return embedding_params


def _count_attention_params_per_layer(
    config,
    hidden_size: int,
    num_attention_heads: int,
    num_key_value_heads: Optional[int]
) -> int:
    """
    Calculate attention parameters per layer.

    For standard attention:
    - Q projection: hidden_size × hidden_size
    - K projection: hidden_size × hidden_size (or smaller for GQA/MQA)
    - V projection: hidden_size × hidden_size (or smaller for GQA/MQA)
    - O projection: hidden_size × hidden_size
    """
    # Q projection
    q_params = hidden_size * hidden_size

    # K and V projections (adjusted for GQA/MQA)
    if num_key_value_heads is None or num_key_value_heads == num_attention_heads:
        # MHA: full size
        kv_params = 2 * hidden_size * hidden_size
    else:
        # GQA/MQA: reduced size
        kv_hidden = (hidden_size // num_attention_heads) * num_key_value_heads
        kv_params = 2 * hidden_size * kv_hidden

    # O projection
    o_params = hidden_size * hidden_size

    return q_params + kv_params + o_params


def _count_ffn_params_per_layer(hidden_size: int, intermediate_size: int) -> int:
    """
    Calculate FFN parameters per layer.

    For standard FFN:
    - Up projection: hidden_size × intermediate_size
    - Down projection: intermediate_size × hidden_size
    - Gate projection (for SwiGLU): hidden_size × intermediate_size
    """
    # Most modern models use SwiGLU (gate + up + down)
    # Conservative estimate: 3 projections
    return 3 * hidden_size * intermediate_size


# Additional helper functions for analysis

def analyze_scaling_properties(features: ModelFeatures) -> Dict[str, Any]:
    """
    Analyze scaling properties of the model architecture.

    Based on Caravaca et al. findings:
    - Layers scale linearly with energy
    - Hidden dimension scales quadratically with energy
    """
    return {
        "layer_complexity": features.num_layers,  # Linear scaling expected
        "dimension_complexity": features.hidden_size ** 2,  # Quadratic scaling expected
        "total_complexity": features.num_layers * (features.hidden_size ** 2),
        "attention_efficiency": features.attention_mechanism,  # GQA/MQA more efficient than MHA
        "is_moe": features.is_moe,  # MoE expected to be more efficient
    }


def compare_architectures(features1: ModelFeatures, features2: ModelFeatures) -> Dict[str, Any]:
    """
    Compare two model architectures for energy prediction.

    Returns relative complexity metrics that correlate with energy differences.
    """
    return {
        "layer_ratio": features1.num_layers / features2.num_layers if features2.num_layers > 0 else 0,
        "dimension_ratio": features1.hidden_size / features2.hidden_size if features2.hidden_size > 0 else 0,
        "param_ratio": features1.total_params / features2.total_params if features2.total_params > 0 else 0,
        "complexity_ratio": (
            (features1.num_layers * features1.hidden_size ** 2) /
            (features2.num_layers * features2.hidden_size ** 2)
            if features2.num_layers > 0 and features2.hidden_size > 0 else 0
        ),
        "attention_mechanism_same": features1.attention_mechanism == features2.attention_mechanism,
        "both_moe": features1.is_moe and features2.is_moe,
    }
