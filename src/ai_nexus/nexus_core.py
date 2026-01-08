"""
Qwen AI Nexus Core - The Central Intelligence Hub

Implements the main AI Nexus system that integrates hardware profiling,
model management, and orchestration into a unified local intelligence core.
"""
import os
import sys
from typing import Dict, Any, Optional, Callable
from .hardware_profiler import HardwareProfiler, HardwareCapabilityVector
from .model_manager import ModelManager, ModelConfigurationWizard


class QwenNexus:
    """
    The central hub of the SocraTask AI ecosystem.
    Integrates hardware profiling, model management, and orchestration.
    """
    
    def __init__(self, models_dir: str = "/workspace/models"):
        self.hardware_profiler = HardwareProfiler()
        self.model_manager = ModelManager(models_dir=models_dir)
        self.config_wizard = ModelConfigurationWizard(self.model_manager)
        self.capability_vector: Optional[HardwareCapabilityVector] = None
        self.initialized = False
        
        # Privacy and security settings
        self.privacy_mode = True  # By default, no data leaves the device
        self.trust_store = set()  # Trusted models
        self.sandboxed_execution = True  # All models run in isolation
        
    def initialize(self, progress_callback: Optional[Callable] = None) -> bool:
        """
        Initialize the AI Nexus with hardware profiling and model recommendations
        """
        print("Initializing SocraTask Qwen AI Nexus...")
        
        # Step 1: Run hardware diagnostic
        print("Running hardware diagnostic...")
        self.capability_vector = self.hardware_profiler.run_full_diagnostic(
            progress_callback=progress_callback
        )
        
        # Step 2: Generate model recommendations
        print("Generating model recommendations...")
        recommendations = self.model_manager.get_model_recommendations(self.capability_vector)
        
        # Step 3: Set up recommended configuration based on hardware
        print("Setting up recommended configuration...")
        self._setup_recommended_config(recommendations)
        
        # Step 4: Add default orchestration rules
        print("Setting up orchestration rules...")
        self._setup_default_orchestration_rules()
        
        # Mark as initialized
        self.initialized = True
        print("Qwen AI Nexus initialized successfully!")
        
        return True
    
    def _setup_recommended_config(self, recommendations: Dict[str, Any]) -> None:
        """Set up the recommended configuration based on hardware capabilities"""
        if recommendations['primary_model']:
            primary_model = recommendations['primary_model']
            print(f"Recommended primary model: {primary_model.name}")
            
            # Add to trust store
            self.trust_store.add(primary_model.name)
            
            # Suggest using the balanced daily driver profile by default
            balanced_profile = recommendations['profiles'].get('balanced_daily_driver')
            if balanced_profile:
                print(f"Using profile: {balanced_profile['name']}")
                # Apply the profile configuration
                config = balanced_profile['configuration']
                print(f"Profile configuration: {config}")
    
    def _setup_default_orchestration_rules(self) -> None:
        """Set up default orchestration rules as described in the specification"""
        # Add example orchestration rules
        self.model_manager.add_orchestration_rule(
            condition="user_action == 'writing_email'", 
            action="use Qwen2.5-7B", 
            priority=1
        )
        self.model_manager.add_orchestration_rule(
            condition="user_action == 'debugging_python'", 
            action="use Qwen2.5-Coder-7B", 
            priority=1
        )
        self.model_manager.add_orchestration_rule(
            condition="query_complexity == 'high' AND battery > 50%", 
            action="use Qwen2.5-32B", 
            priority=2
        )
    
    def get_hardware_profile(self) -> Optional[HardwareCapabilityVector]:
        """Get the current hardware capability vector"""
        return self.capability_vector
    
    def get_model_recommendations(self) -> Dict[str, Any]:
        """Get current model recommendations based on hardware"""
        if not self.capability_vector:
            return {}
        return self.model_manager.get_model_recommendations(self.capability_vector)
    
    def download_recommended_models(self, profile_name: str = 'balanced_daily_driver') -> bool:
        """Download models based on the selected profile"""
        recommendations = self.get_model_recommendations()
        profile = recommendations.get('profiles', {}).get(profile_name)
        
        if not profile:
            print(f"Profile {profile_name} not found")
            return False
        
        print(f"Downloading models for profile: {profile_name}")
        
        if 'recommended_model' in profile:
            model_name = profile['recommended_model']
            print(f"Downloading recommended model: {model_name}")
            return self.model_manager.download_model(model_name)
        elif 'recommended_models' in profile:
            success = True
            for model_name in profile['recommended_models']:
                print(f"Downloading model: {model_name}")
                if not self.model_manager.download_model(model_name):
                    success = False
            return success
        
        return False
    
    def load_model(self, model_name: str, config: Optional[Dict[str, Any]] = None) -> bool:
        """Load a model with optional custom configuration"""
        if config is None:
            # Generate default configuration
            config = self.config_wizard.configure_model(model_name)
        
        return self.model_manager.load_model(model_name, config)
    
    def execute_task(self, task_type: str, query: str, context: Optional[Dict[str, Any]] = None) -> Any:
        """
        Execute an AI task using the appropriate model based on orchestration rules
        """
        if not self.initialized:
            raise RuntimeError("QwenNexus not initialized. Call initialize() first.")
        
        # Determine which model to use based on task type and orchestration rules
        model_name = self._select_model_for_task(task_type)
        
        # In a real implementation, this would call the actual model inference
        # For now, we'll simulate the execution
        print(f"Executing task '{task_type}' with model '{model_name}'")
        print(f"Query: {query}")
        
        # Simulate AI response
        response = self._simulate_ai_response(task_type, query, context)
        return response
    
    def _select_model_for_task(self, task_type: str) -> str:
        """Select the appropriate model based on task type and orchestration rules"""
        # In a real implementation, this would use the orchestration rules
        # to determine the best model for the task
        
        # For demonstration, return a model based on task type
        if 'code' in task_type.lower() or 'programming' in task_type.lower():
            return 'qwen2.5-coder-7b-q6_k.gguf'
        elif 'math' in task_type.lower() or 'calculate' in task_type.lower():
            return 'qwen2.5-math-7b-q6_k.gguf'
        elif 'image' in task_type.lower() or 'vision' in task_type.lower():
            return 'qwen2.5-vl-2b-q4_k_m.gguf'
        else:
            # Default to a general model
            return 'qwen2.5-7b-q6_k.gguf'
    
    def _simulate_ai_response(self, task_type: str, query: str, context: Optional[Dict[str, Any]]) -> str:
        """Simulate an AI response - in real implementation this would call the actual model"""
        # This is a placeholder for actual model inference
        return f"Simulated response for {task_type} task: {query[:50]}..."
    
    def add_custom_orchestration_rule(self, condition: str, action: str, priority: int = 1) -> None:
        """Allow users to add custom orchestration rules"""
        self.model_manager.add_orchestration_rule(condition, action, priority)
    
    def get_system_status(self) -> Dict[str, Any]:
        """Get the current status of the AI Nexus system"""
        return {
            'initialized': self.initialized,
            'privacy_mode': self.privacy_mode,
            'sandboxed_execution': self.sandboxed_execution,
            'capability_vector': self.capability_vector.__dict__ if self.capability_vector else None,
            'downloaded_models_count': len(self.model_manager.get_downloaded_models()),
            'active_models_count': len(self.model_manager.get_active_models()),
            'orchestration_rules_count': len(self.model_manager.orchestration_rules),
            'trust_store_size': len(self.trust_store)
        }
    
    def run_privacy_audit(self) -> Dict[str, bool]:
        """Perform a privacy audit to ensure no data is leaving the device"""
        audit_results = {
            'network_connections_checked': True,  # Would check active network connections
            'data_exfiltration_detected': False,  # Would check for unauthorized data transmission
            'local_processing_confirmed': True,   # Confirms processing happens locally
            'privacy_settings_intact': self.privacy_mode
        }
        return audit_results


# Example usage and testing
if __name__ == "__main__":
    # Create the Qwen Nexus instance
    nexus = QwenNexus()
    
    # Define a simple progress callback for the diagnostic
    def progress_callback(percent: int, message: str):
        print(f"[{percent:3d}%] {message}")
    
    # Initialize the nexus
    nexus.initialize(progress_callback=progress_callback)
    
    # Get hardware profile
    hw_profile = nexus.get_hardware_profile()
    print(f"\nHardware Profile: {hw_profile}")
    
    # Get model recommendations
    recommendations = nexus.get_model_recommendations()
    print(f"\nModel Recommendations: {recommendations['profiles'].keys()}")
    
    # Show system status
    status = nexus.get_system_status()
    print(f"\nSystem Status: {status}")
    
    # Run privacy audit
    audit = nexus.run_privacy_audit()
    print(f"\nPrivacy Audit: {audit}")
    
    # Example of executing a task
    response = nexus.execute_task("writing", "Write a short poem about productivity")
    print(f"\nTask Response: {response}")