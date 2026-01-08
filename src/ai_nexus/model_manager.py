"""
Model Manager & Advanced Orchestration for SocraTask AI Nexus

Manages the Qwen model ecosystem, downloads, configurations, and runtime orchestration.
Implements the "Bring-Your-Own-Model" paradigm with intelligent recommendations.
"""
import os
import json
import requests
import hashlib
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from .hardware_profiler import HardwareCapabilityVector


@dataclass
class ModelSpec:
    """Specification for a Qwen model"""
    name: str
    family: str
    size: str  # e.g., "0.5B", "1.5B", "7B", "32B"
    variant: str  # e.g., "Qwen2.5", "Qwen2.5-Coder", "Qwen2.5-Math", "Qwen2.5-VL", "Qwen2.5-Audio"
    quantization: str  # e.g., "Q8_0", "Q6_K", "Q4_K_M", "IQ4_XS"
    disk_size_gb: float
    ram_requirement_gb: float
    recommended_hardware: str
    description: str
    download_url: str
    checksum: str


class ModelManager:
    """Advanced model management and orchestration system"""
    
    def __init__(self, models_dir: str = "/workspace/models"):
        self.models_dir = Path(models_dir)
        self.models_dir.mkdir(exist_ok=True)
        self.downloaded_models: List[ModelSpec] = []
        self.active_models: Dict[str, Any] = {}  # Currently loaded models
        self.model_catalog = self._initialize_model_catalog()
        self.orchestration_rules = []
        
    def _initialize_model_catalog(self) -> List[ModelSpec]:
        """Initialize the local catalog of available Qwen models"""
        # This would normally load from a JSON file, but we'll create a representative catalog
        catalog = [
            # Qwen2.5 General Models
            ModelSpec(
                name="qwen2.5-0.5b-q4_k_m.gguf",
                family="Qwen2.5",
                size="0.5B",
                variant="Qwen2.5",
                quantization="Q4_K_M",
                disk_size_gb=0.3,
                ram_requirement_gb=0.5,
                recommended_hardware="8GB+ RAM",
                description="General purpose model, efficient quantization",
                download_url="https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf",
                checksum="checksum_placeholder_0.5b_q4"
            ),
            ModelSpec(
                name="qwen2.5-1.5b-q4_k_m.gguf",
                family="Qwen2.5",
                size="1.5B",
                variant="Qwen2.5",
                quantization="Q4_K_M",
                disk_size_gb=0.9,
                ram_requirement_gb=1.2,
                recommended_hardware="8GB+ RAM",
                description="General purpose model with good capabilities",
                download_url="https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
                checksum="checksum_placeholder_1.5b_q4"
            ),
            ModelSpec(
                name="qwen2.5-7b-q6_k.gguf",
                family="Qwen2.5",
                size="7B",
                variant="Qwen2.5",
                quantization="Q6_K",
                disk_size_gb=5.2,
                ram_requirement_gb=6.5,
                recommended_hardware="16GB+ RAM, 4GB+ VRAM recommended",
                description="Balanced general purpose model",
                download_url="https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q6_k.gguf",
                checksum="checksum_placeholder_7b_q6"
            ),
            ModelSpec(
                name="qwen2.5-32b-q8_0.gguf",
                family="Qwen2.5",
                size="32B",
                variant="Qwen2.5",
                quantization="Q8_0",
                disk_size_gb=24.0,
                ram_requirement_gb=32.0,
                recommended_hardware="32GB+ RAM, 8GB+ VRAM recommended",
                description="High capability general purpose model",
                download_url="https://huggingface.co/Qwen/Qwen2.5-32B-Instruct-GGUF/resolve/main/qwen2.5-32b-instruct-q8_0.gguf",
                checksum="checksum_placeholder_32b_q8"
            ),
            
            # Qwen2.5 Coder Models
            ModelSpec(
                name="qwen2.5-coder-1.5b-q4_k_m.gguf",
                family="Qwen2.5-Coder",
                size="1.5B",
                variant="Qwen2.5-Coder",
                quantization="Q4_K_M",
                disk_size_gb=0.9,
                ram_requirement_gb=1.2,
                recommended_hardware="8GB+ RAM",
                description="Specialized for code generation and debugging",
                download_url="https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf",
                checksum="checksum_placeholder_coder_1.5b_q4"
            ),
            ModelSpec(
                name="qwen2.5-coder-7b-q6_k.gguf",
                family="Qwen2.5-Coder",
                size="7B",
                variant="Qwen2.5-Coder",
                quantization="Q6_K",
                disk_size_gb=5.2,
                ram_requirement_gb=6.5,
                recommended_hardware="16GB+ RAM, 4GB+ VRAM recommended",
                description="Advanced code generation and debugging model",
                download_url="https://huggingface.co/Qwen/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/qwen2.5-coder-7b-instruct-q6_k.gguf",
                checksum="checksum_placeholder_coder_7b_q6"
            ),
            
            # Qwen2.5 Math Models
            ModelSpec(
                name="qwen2.5-math-1.5b-q4_k_m.gguf",
                family="Qwen2.5-Math",
                size="1.5B",
                variant="Qwen2.5-Math",
                quantization="Q4_K_M",
                disk_size_gb=0.9,
                ram_requirement_gb=1.2,
                recommended_hardware="8GB+ RAM",
                description="Specialized for mathematical reasoning",
                download_url="https://huggingface.co/Qwen/Qwen2.5-Math-1.5B-Instruct-GGUF/resolve/main/qwen2.5-math-1.5b-instruct-q4_k_m.gguf",
                checksum="checksum_placeholder_math_1.5b_q4"
            ),
            ModelSpec(
                name="qwen2.5-math-7b-q6_k.gguf",
                family="Qwen2.5-Math",
                size="7B",
                variant="Qwen2.5-Math",
                quantization="Q6_K",
                disk_size_gb=5.2,
                ram_requirement_gb=6.5,
                recommended_hardware="16GB+ RAM, 4GB+ VRAM recommended",
                description="Advanced mathematical reasoning model",
                download_url="https://huggingface.co/Qwen/Qwen2.5-Math-7B-Instruct-GGUF/resolve/main/qwen2.5-math-7b-instruct-q6_k.gguf",
                checksum="checksum_placeholder_math_7b_q6"
            ),
            
            # Qwen2.5 Vision Language Models
            ModelSpec(
                name="qwen2.5-vl-2b-q4_k_m.gguf",
                family="Qwen2.5-VL",
                size="2B",
                variant="Qwen2.5-VL",
                quantization="Q4_K_M",
                disk_size_gb=1.5,
                ram_requirement_gb=2.0,
                recommended_hardware="8GB+ RAM, 4GB+ VRAM recommended",
                description="Vision-language model for image analysis",
                download_url="https://huggingface.co/Qwen/Qwen2.5-VL-2B-Instruct-GGUF/resolve/main/qwen2.5-vl-2b-instruct-q4_k_m.gguf",
                checksum="checksum_placeholder_vl_2b_q4"
            ),
        ]
        
        return catalog
    
    def get_model_recommendations(self, capability_vector: HardwareCapabilityVector) -> Dict[str, Any]:
        """Generate model recommendations based on hardware capability vector"""
        recommendations = {
            'primary_model': None,
            'alternative_models': [],
            'profiles': {}
        }
        
        # Filter models based on hardware capabilities
        suitable_models = []
        for model in self.model_catalog:
            # Check RAM requirements
            if model.ram_requirement_gb <= capability_vector.ram_gb:
                # If GPU is available, consider VRAM requirements for larger models
                if capability_vector.gpu_vram_gb and model.size in ["7B", "32B"]:
                    if model.ram_requirement_gb * 0.7 <= capability_vector.gpu_vram_gb:  # Approximate GPU offloading
                        suitable_models.append(model)
                elif model.size not in ["7B", "32B"]:  # Smaller models that fit in CPU RAM
                    suitable_models.append(model)
        
        # Sort by relevance to hardware
        suitable_models.sort(key=lambda m: m.ram_requirement_gb, reverse=True)
        
        if suitable_models:
            recommendations['primary_model'] = suitable_models[0]
            recommendations['alternative_models'] = suitable_models[1:4]  # Top 3 alternatives
            
            # Generate AI profiles based on hardware
            profiles = self._generate_ai_profiles(capability_vector, suitable_models)
            recommendations['profiles'] = profiles
        
        return recommendations
    
    def _generate_ai_profiles(self, capability_vector: HardwareCapabilityVector, suitable_models: List[ModelSpec]) -> Dict[str, Any]:
        """Generate the 4 AI profiles as described in the spec"""
        profiles = {}
        
        # Find appropriate models for each profile
        tiny_model = next((m for m in suitable_models if m.size == "0.5B"), 
                         next((m for m in suitable_models if "0.5" in m.size), suitable_models[0] if suitable_models else None))
        small_model = next((m for m in suitable_models if m.size == "1.5B"), 
                          next((m for m in suitable_models if "1.5" in m.size), tiny_model))
        medium_model = next((m for m in suitable_models if m.size == "7B"), 
                           next((m for m in suitable_models if "7" in m.size), small_model))
        
        # Profile 1: Balanced Daily Driver
        profiles['balanced_daily_driver'] = {
            'name': 'Balanced Daily Driver',
            'description': 'A single capable model for all tasks',
            'recommended_model': medium_model.name if medium_model else small_model.name,
            'configuration': {
                'context_window': 4096,
                'gpu_layers': 20 if capability_vector.gpu_vram_gb and capability_vector.gpu_vram_gb >= 4 else 0,
                'threads': capability_vector.cpu_cores
            }
        }
        
        # Profile 2: Specialist Ensemble
        coder_model = next((m for m in suitable_models if "Coder" in m.variant), small_model)
        math_model = next((m for m in suitable_models if "Math" in m.variant), small_model)
        general_model = next((m for m in suitable_models if "Qwen2.5" == m.variant), small_model)
        
        profiles['specialist_ensemble'] = {
            'name': 'Specialist Ensemble',
            'description': 'Multiple smaller, fine-tuned models with automatic routing',
            'recommended_models': [coder_model.name, math_model.name, general_model.name],
            'configuration': {
                'routing_rules': [
                    {'task': 'coding', 'model': coder_model.name},
                    {'task': 'math', 'model': math_model.name},
                    {'task': 'general', 'model': general_model.name}
                ],
                'context_window': 4096,
                'gpu_layers': 10 if capability_vector.gpu_vram_gb and capability_vector.gpu_vram_gb >= 4 else 0
            }
        }
        
        # Profile 3: Speed Demon
        profiles['speed_demon'] = {
            'name': 'Speed Demon',
            'description': 'Tiny model for near-instant responses, with option for larger models',
            'recommended_model': tiny_model.name if tiny_model else small_model.name,
            'configuration': {
                'context_window': 2048,
                'gpu_layers': 0,  # CPU only for fastest response
                'threads': capability_vector.cpu_cores,
                'fallback_model': medium_model.name if medium_model else small_model.name
            }
        }
        
        # Profile 4: Power User Config
        profiles['power_user_config'] = {
            'name': 'Power User Config',
            'description': 'Manual control to define everything',
            'recommended_model': medium_model.name if (
                capability_vector.ram_gb >= 16 and capability_vector.gpu_vram_gb and capability_vector.gpu_vram_gb >= 4
            ) else small_model.name,
            'configuration': {
                'context_window': 8192 if capability_vector.ram_gb >= 16 else 4096,
                'gpu_layers': 30 if capability_vector.gpu_vram_gb and capability_vector.gpu_vram_gb >= 8 else (
                    20 if capability_vector.gpu_vram_gb and capability_vector.gpu_vram_gb >= 4 else 5
                ),
                'threads': capability_vector.cpu_threads,
                'custom_rules': []
            }
        }
        
        return profiles
    
    def download_model(self, model_name: str, progress_callback=None) -> bool:
        """Download a model from the catalog with validation"""
        model_spec = next((m for m in self.model_catalog if m.name == model_name), None)
        if not model_spec:
            print(f"Model {model_name} not found in catalog")
            return False
        
        model_path = self.models_dir / model_name
        
        # Check if model already exists
        if model_path.exists():
            print(f"Model {model_name} already exists at {model_path}")
            # Verify checksum
            if self._verify_model_checksum(model_path, model_spec.checksum):
                print(f"Checksum verified for {model_name}")
                return True
            else:
                print(f"Checksum mismatch for {model_name}, re-downloading...")
        
        # Download the model
        try:
            print(f"Downloading {model_name} from {model_spec.download_url}")
            
            # Stream download with progress
            response = requests.get(model_spec.download_url, stream=True)
            response.raise_for_status()
            
            total_size = int(response.headers.get('content-length', 0))
            downloaded = 0
            
            with open(model_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total_size and progress_callback:
                            progress = int(100 * downloaded / total_size)
                            progress_callback(progress, f"Downloading {model_name}")
            
            # Verify checksum after download
            if self._verify_model_checksum(model_path, model_spec.checksum):
                print(f"Successfully downloaded and verified {model_name}")
                # Add to downloaded models list
                self.downloaded_models.append(model_spec)
                return True
            else:
                print(f"Checksum verification failed for {model_name}")
                model_path.unlink()  # Remove corrupted file
                return False
                
        except Exception as e:
            print(f"Error downloading {model_name}: {str(e)}")
            if model_path.exists():
                model_path.unlink()  # Remove partially downloaded file
            return False
    
    def _verify_model_checksum(self, model_path: Path, expected_checksum: str) -> bool:
        """Verify the downloaded model's integrity"""
        # In a real implementation, this would calculate the actual checksum
        # For now, we'll just return True as a placeholder
        print(f"Verifying checksum for {model_path.name}...")
        return True  # Placeholder
    
    def load_model(self, model_name: str, config: Dict[str, Any] = None) -> bool:
        """Load a model into memory for inference"""
        model_path = self.models_dir / model_name
        if not model_path.exists():
            print(f"Model {model_name} not found at {model_path}")
            return False
        
        # In a real implementation, this would load the model using a library like llama-cpp-python
        # For now, we'll just simulate the loading process
        print(f"Loading model {model_name} with config: {config}")
        
        # Store in active models
        self.active_models[model_name] = {
            'path': str(model_path),
            'config': config or {},
            'status': 'loaded',
            'load_time': 'simulated'
        }
        
        return True
    
    def unload_model(self, model_name: str) -> bool:
        """Unload a model from memory"""
        if model_name in self.active_models:
            print(f"Unloading model {model_name}")
            del self.active_models[model_name]
            return True
        return False
    
    def add_orchestration_rule(self, condition: str, action: str, priority: int = 1) -> None:
        """Add a runtime orchestration rule"""
        rule = {
            'condition': condition,
            'action': action,
            'priority': priority,
            'id': len(self.orchestration_rules)
        }
        self.orchestration_rules.append(rule)
        print(f"Added orchestration rule: IF {condition} THEN {action}")
    
    def get_available_models(self) -> List[ModelSpec]:
        """Get list of all available models in the catalog"""
        return self.model_catalog
    
    def get_downloaded_models(self) -> List[ModelSpec]:
        """Get list of downloaded models"""
        return self.downloaded_models
    
    def get_active_models(self) -> Dict[str, Any]:
        """Get list of currently loaded models"""
        return self.active_models
    
    def get_model_by_name(self, name: str) -> Optional[ModelSpec]:
        """Get a specific model by name"""
        return next((m for m in self.model_catalog if m.name == name), None)


class ModelConfigurationWizard:
    """Interactive configuration wizard for individual models"""
    
    def __init__(self, model_manager: ModelManager):
        self.model_manager = model_manager
    
    def configure_model(self, model_name: str) -> Dict[str, Any]:
        """Generate configuration for a specific model based on user preferences and hardware"""
        model_spec = self.model_manager.get_model_by_name(model_name)
        if not model_spec:
            raise ValueError(f"Model {model_name} not found")
        
        # In a real implementation, this would present an interactive UI
        # For now, we'll generate a reasonable configuration based on model size
        config = {
            'model_path': str(self.model_manager.models_dir / model_name),
            'context_window': self._suggest_context_window(model_spec),
            'gpu_layers': self._suggest_gpu_layers(model_spec),
            'threads': self._suggest_thread_count(),
            'batch_size': 512,
            'n_batch': 512,
            'temperature': 0.7,
            'top_p': 0.9,
            'repeat_penalty': 1.1
        }
        
        return config
    
    def _suggest_context_window(self, model_spec: ModelSpec) -> int:
        """Suggest appropriate context window based on model size and capabilities"""
        if "32B" in model_spec.size:
            return 8192
        elif "7B" in model_spec.size:
            return 4096
        else:
            return 2048
    
    def _suggest_gpu_layers(self, model_spec: ModelSpec) -> int:
        """Suggest number of GPU layers based on model size and available VRAM"""
        # This would normally check actual GPU capabilities
        # For now, return a reasonable default
        if "32B" in model_spec.size:
            return 30
        elif "7B" in model_spec.size:
            return 20
        else:
            return 5
    
    def _suggest_thread_count(self) -> int:
        """Suggest thread count based on CPU capabilities"""
        import psutil
        return min(psutil.cpu_count(logical=True), 16)  # Cap at 16 threads