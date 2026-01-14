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
    num_experts: Optional[int]  # Total number of experts (for MoE models)
    num_active_experts: Optional[int]  # Number of experts activated per token (for MoE models)

    # Model metadata
    model_name: str
    architecture_type: str  # "llama", "mistral", "phi", "qwen", etc.

    # Quantization detection
    precision: str  # "FP32", "FP16", "BF16", "FP8", "INT8", "INT4", or "MIXED"
    quantization_method: Optional[str]  # E.g., "gptq", "gguf", "awq", "bitsandbytes", None

    # Derived metrics
    attention_to_ffn_ratio: float  # Ratio of attention params to FFN params
    params_per_layer: int
    effective_params_per_token: Optional[int]  # For MoE: active_experts * expert_params

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
            "num_experts": self.num_experts,
            "num_active_experts": self.num_active_experts,
            "model_name": self.model_name,
            "architecture_type": self.architecture_type,
            "precision": self.precision,
            "quantization_method": self.quantization_method,
            "attention_to_ffn_ratio": self.attention_to_ffn_ratio,
            "params_per_layer": self.params_per_layer,
            "effective_params_per_token": self.effective_params_per_token,
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
    is_moe, num_experts, num_active_experts = _detect_moe(model, config)

    # Count parameters
    total_params = sum(p.numel() for p in model.parameters())
    embedding_params = _count_embedding_params(model)
    attention_params_per_layer = _count_attention_params_per_layer(config, hidden_size, num_attention_heads, num_key_value_heads)
    ffn_params_per_layer = _count_ffn_params_per_layer(hidden_size, intermediate_size)

    # Detect quantization
    precision, quantization_method = _detect_quantization(model, config)

    # Calculate derived metrics
    params_per_layer = attention_params_per_layer + ffn_params_per_layer
    attention_to_ffn_ratio = attention_params_per_layer / ffn_params_per_layer if ffn_params_per_layer > 0 else 0.0

    # Calculate effective parameters per token for MoE models
    effective_params_per_token = None
    if is_moe and num_active_experts is not None and num_experts is not None and num_experts > 0:
        # For MoE: only active experts are used per token
        # Effective params = embedding + (attention + active_expert_ffn) * num_layers
        expert_ffn_params = ffn_params_per_layer // num_experts if num_experts > 0 else ffn_params_per_layer
        active_ffn_params = expert_ffn_params * num_active_experts
        effective_params_per_token = embedding_params + (attention_params_per_layer + active_ffn_params) * num_layers

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
        num_experts=num_experts,
        num_active_experts=num_active_experts,
        model_name=model_name,
        architecture_type=architecture_type,
        precision=precision,
        quantization_method=quantization_method,
        attention_to_ffn_ratio=attention_to_ffn_ratio,
        params_per_layer=params_per_layer,
        effective_params_per_token=effective_params_per_token,
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


def _detect_moe(model: torch.nn.Module, config) -> tuple[bool, Optional[int], Optional[int]]:
    """
    Detect if the model uses Mixture of Experts.

    Returns:
        Tuple of (is_moe, num_experts, num_active_experts)
    """
    # Check for MoE-specific config attributes
    if hasattr(config, "num_local_experts"):
        num_experts = getattr(config, "num_local_experts")
        num_active_experts = getattr(config, "num_experts_per_tok", None)
        return True, num_experts, num_active_experts

    if hasattr(config, "num_experts"):
        num_experts = getattr(config, "num_experts")
        num_active_experts = getattr(config, "num_experts_per_tok", None) or getattr(config, "top_k", None)
        return True, num_experts, num_active_experts

    # Check for MoE in module names
    for name, module in model.named_modules():
        if "moe" in name.lower() or "expert" in name.lower():
            # Found MoE but couldn't determine expert counts from config
            return True, None, None

    return False, None, None


def _detect_quantization(model: torch.nn.Module, config) -> tuple[str, Optional[str]]:
    """
    Detect model precision and quantization method.

    Returns:
        Tuple of (precision, quantization_method)
        - precision: "FP32", "FP16", "BF16", "FP8", "INT8", "INT4", "MIXED"
        - quantization_method: "gptq", "gguf", "awq", "bitsandbytes", None

    Note: Apple Silicon may behave differently than NVIDIA GPUs for quantization.
    """
    # Check config for quantization indicators
    quantization_method = None

    # Check for common quantization methods in config
    if hasattr(config, "quantization_config"):
        quant_config = config.quantization_config
        # GPTQ
        if hasattr(quant_config, "quant_method") and quant_config.quant_method == "gptq":
            quantization_method = "gptq"
        # AWQ
        elif hasattr(quant_config, "quant_method") and quant_config.quant_method == "awq":
            quantization_method = "awq"
        # BitsAndBytes
        elif hasattr(quant_config, "load_in_4bit") or hasattr(quant_config, "load_in_8bit"):
            quantization_method = "bitsandbytes"

    # Check model name for quantization hints
    model_type = getattr(config, "_name_or_path", "").lower()
    if "gptq" in model_type:
        quantization_method = "gptq"
    elif "awq" in model_type:
        quantization_method = "awq"
    elif "gguf" in model_type or "ggml" in model_type:
        quantization_method = "gguf"

    # Detect precision from model parameters
    dtypes = set()
    param_count = 0

    for param in model.parameters():
        if param_count >= 100:  # Sample first 100 parameters for efficiency
            break
        dtypes.add(param.dtype)
        param_count += 1

    # Determine precision from detected dtypes
    if len(dtypes) > 1:
        precision = "MIXED"
    elif torch.float32 in dtypes:
        precision = "FP32"
    elif torch.float16 in dtypes:
        precision = "FP16"
    elif torch.bfloat16 in dtypes:
        precision = "BF16"
    elif torch.float8_e4m3fn in dtypes or torch.float8_e5m2 in dtypes:
        precision = "FP8"
    elif torch.int8 in dtypes or torch.qint8 in dtypes:
        precision = "INT8"
    elif torch.qint4x2 in dtypes:
        precision = "INT4"
    else:
        # Default to FP32 if cannot determine
        precision = "FP32"

    # Override precision if quantization method suggests lower precision
    if quantization_method in ["gptq", "awq"] and precision in ["FP32", "FP16", "BF16"]:
        # These methods typically use INT4 or INT8
        precision = "INT4"  # Most common for GPTQ/AWQ
    elif quantization_method == "bitsandbytes":
        if hasattr(config, "quantization_config"):
            if getattr(config.quantization_config, "load_in_4bit", False):
                precision = "INT4"
            elif getattr(config.quantization_config, "load_in_8bit", False):
                precision = "INT8"

    return precision, quantization_method


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


def compare_quantization_levels(runs_by_precision: Dict[str, Any]) -> Dict[str, Any]:
    """
    Compare energy consumption across different quantization levels.

    Args:
        runs_by_precision: Dictionary mapping precision -> list of run data
            e.g., {"FP16": [run1, run2], "INT8": [run3, run4]}

    Returns:
        Comparison metrics showing energy savings from quantization

    Note: Apple Silicon may behave differently than NVIDIA GPUs.
    On NVIDIA, quantization significantly reduces energy in memory-constrained scenarios.
    """
    # Order precisions by expected bit width (higher to lower)
    precision_order = ["FP32", "FP16", "BF16", "FP8", "INT8", "INT4"]

    comparison = {
        "precision_levels": [],
        "average_energy_per_token": {},
        "energy_savings": {},
        "throughput": {},
        "notes": []
    }

    # Calculate averages per precision
    for precision in precision_order:
        if precision not in runs_by_precision:
            continue

        runs = runs_by_precision[precision]
        if not runs:
            continue

        avg_energy = sum(r.get("energy_per_token_mj", 0) for r in runs) / len(runs)
        avg_throughput = sum(r.get("tokens_per_second", 0) for r in runs) / len(runs)

        comparison["precision_levels"].append(precision)
        comparison["average_energy_per_token"][precision] = avg_energy
        comparison["throughput"][precision] = avg_throughput

    # Calculate relative savings compared to FP32 baseline
    baseline_precision = None
    baseline_energy = None

    for precision in precision_order:
        if precision in comparison["average_energy_per_token"]:
            if baseline_precision is None:
                baseline_precision = precision
                baseline_energy = comparison["average_energy_per_token"][precision]
            else:
                current_energy = comparison["average_energy_per_token"][precision]
                savings_percent = ((baseline_energy - current_energy) / baseline_energy * 100) if baseline_energy > 0 else 0
                comparison["energy_savings"][f"{precision}_vs_{baseline_precision}"] = {
                    "absolute_mj": baseline_energy - current_energy,
                    "percent": savings_percent
                }

    # Add notes about Apple Silicon behavior
    comparison["notes"].append(
        "Note: Apple Silicon (M4 Max) uses unified memory architecture, "
        "which may show different quantization benefits compared to NVIDIA GPUs."
    )
    comparison["notes"].append(
        "TokenPowerBench paper (NVIDIA): Quantization significantly reduces energy "
        "in memory-constrained scenarios, especially for large models."
    )

    return comparison


def analyze_moe_efficiency(moe_run: Dict[str, Any], dense_run: Dict[str, Any]) -> Dict[str, Any]:
    """
    Compare energy efficiency of MoE model vs equivalent dense model.

    Args:
        moe_run: Profiling run data for MoE model
        dense_run: Profiling run data for dense model with similar quality

    Returns:
        Analysis showing MoE efficiency gains

    Reference: TokenPowerBench paper - MoE uses 2-3× less energy than dense with similar quality
    """
    analysis = {
        "moe_model": moe_run.get("model_name", "Unknown"),
        "dense_model": dense_run.get("model_name", "Unknown"),
        "metrics": {},
        "efficiency_gains": {},
        "notes": []
    }

    # Energy comparison
    moe_energy = moe_run.get("total_energy_mj", 0)
    dense_energy = dense_run.get("total_energy_mj", 0)
    energy_ratio = dense_energy / moe_energy if moe_energy > 0 else 0

    analysis["metrics"]["moe_energy_mj"] = moe_energy
    analysis["metrics"]["dense_energy_mj"] = dense_energy
    analysis["efficiency_gains"]["energy_reduction_factor"] = energy_ratio
    analysis["efficiency_gains"]["energy_savings_percent"] = ((dense_energy - moe_energy) / dense_energy * 100) if dense_energy > 0 else 0

    # Parameter efficiency
    moe_total_params = moe_run.get("total_params", 0)
    moe_effective_params = moe_run.get("effective_params_per_token", moe_total_params)
    dense_params = dense_run.get("total_params", 0)

    analysis["metrics"]["moe_total_params"] = moe_total_params
    analysis["metrics"]["moe_effective_params"] = moe_effective_params
    analysis["metrics"]["dense_params"] = dense_params
    analysis["metrics"]["moe_param_efficiency"] = moe_effective_params / moe_total_params if moe_total_params > 0 else 0

    # Energy per effective parameter
    moe_energy_per_param = moe_energy / moe_effective_params if moe_effective_params > 0 else 0
    dense_energy_per_param = dense_energy / dense_params if dense_params > 0 else 0

    analysis["metrics"]["moe_energy_per_effective_param"] = moe_energy_per_param
    analysis["metrics"]["dense_energy_per_param"] = dense_energy_per_param

    # Throughput comparison
    moe_throughput = moe_run.get("tokens_per_second", 0)
    dense_throughput = dense_run.get("tokens_per_second", 0)
    throughput_ratio = moe_throughput / dense_throughput if dense_throughput > 0 else 0

    analysis["metrics"]["moe_throughput_tokens_per_sec"] = moe_throughput
    analysis["metrics"]["dense_throughput_tokens_per_sec"] = dense_throughput
    analysis["efficiency_gains"]["throughput_improvement_factor"] = throughput_ratio

    # Add context notes
    analysis["notes"].append(
        f"TokenPowerBench finding: MoE models typically use 2-3× less energy than dense models with similar quality."
    )
    analysis["notes"].append(
        f"This analysis shows {energy_ratio:.2f}× energy reduction with MoE vs dense model."
    )
    analysis["notes"].append(
        f"MoE activates only {moe_run.get('num_active_experts', 'N/A')} of {moe_run.get('num_experts', 'N/A')} experts per token, "
        f"reducing effective parameters to {moe_effective_params:,} vs {moe_total_params:,} total."
    )

    return analysis


def calculate_moe_expert_balance(expert_activations: list[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analyze load balance across experts in MoE model.

    Args:
        expert_activations: List of expert activation records per token

    Returns:
        Load balance metrics including entropy and expert utilization
    """
    if not expert_activations:
        return {
            "expert_utilization": {},
            "load_balance_score": 0.0,
            "notes": ["No expert activation data available"]
        }

    # Count activations per expert
    expert_counts = {}
    total_activations = 0

    for activation in expert_activations:
        active_experts = activation.get("active_expert_ids", "").split(",")
        for expert_id in active_experts:
            if expert_id:
                expert_counts[expert_id] = expert_counts.get(expert_id, 0) + 1
                total_activations += 1

    # Calculate utilization per expert
    expert_utilization = {}
    for expert_id, count in expert_counts.items():
        expert_utilization[expert_id] = {
            "activation_count": count,
            "utilization_percent": (count / total_activations * 100) if total_activations > 0 else 0
        }

    # Calculate load balance score (1.0 = perfect balance, 0.0 = unbalanced)
    num_experts = len(expert_counts)
    if num_experts > 0:
        expected_per_expert = total_activations / num_experts
        variance = sum((count - expected_per_expert) ** 2 for count in expert_counts.values()) / num_experts
        std_dev = variance ** 0.5
        # Normalize to 0-1 scale (lower std_dev = better balance)
        load_balance_score = max(0.0, 1.0 - (std_dev / expected_per_expert)) if expected_per_expert > 0 else 0.0
    else:
        load_balance_score = 0.0

    return {
        "expert_utilization": expert_utilization,
        "load_balance_score": load_balance_score,
        "total_activations": total_activations,
        "num_experts_used": num_experts,
        "notes": [
            f"Load balance score: {load_balance_score:.2f} (1.0 = perfect balance)",
            f"Total activations across {num_experts} experts: {total_activations}"
        ]
    }
