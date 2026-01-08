"""
SocraTask - The Sovereign Productivity & Education Ecosystem
Main Application Entry Point

This file demonstrates the Qwen AI Nexus implementation as described in the project brief.
"""
import sys
import os
from src.ai_nexus import QwenNexus


def main():
    print("="*60)
    print("SocraTask - The Sovereign Productivity & Education Ecosystem")
    print("Qwen AI Nexus - Local Intelligence Core")
    print("="*60)
    
    print("\nInitializing the Qwen AI Nexus...")
    print("This will perform a comprehensive 90-second hardware diagnostic")
    print("to build a 'Performance Blueprint' of your device.\n")
    
    # Create the Qwen Nexus instance
    nexus = QwenNexus(models_dir="./models")
    
    # Define a simple progress callback for the diagnostic
    def progress_callback(percent: int, message: str):
        print(f"[{percent:3d}%] {message}")
    
    try:
        # Initialize the nexus
        print("Starting hardware diagnostic and AI Nexus initialization...\n")
        nexus.initialize(progress_callback=progress_callback)
        
        print("\n" + "="*60)
        print("DIAGNOSTIC COMPLETE!")
        print("="*60)
        
        # Get hardware profile
        hw_profile = nexus.get_hardware_profile()
        print(f"\nHardware Profile Detected:")
        print(f"  Architecture: {hw_profile.architecture}")
        print(f"  CPU Cores: {hw_profile.cpu_cores}")
        print(f"  CPU Threads: {hw_profile.cpu_threads}")
        print(f"  CPU Speed: {hw_profile.cpu_speed:.2f} GHz")
        print(f"  RAM: {hw_profile.ram_gb} GB")
        print(f"  GPU: {hw_profile.gpu_name or 'None'} ({hw_profile.gpu_vram_gb or 0} GB VRAM)")
        print(f"  Storage Tier: {hw_profile.storage_tier}")
        print(f"  Thermal Profile: {hw_profile.thermal_profile}")
        print(f"  Special Instructions: {', '.join(hw_profile.special_instructions or ['None'])}")
        
        # Get model recommendations
        recommendations = nexus.get_model_recommendations()
        print(f"\nModel Recommendations Based on Your Hardware:")
        
        primary_model = recommendations['primary_model']
        if primary_model:
            print(f"  Primary Model: {primary_model.name}")
            print(f"    Size: {primary_model.size}, Quantization: {primary_model.quantization}")
            print(f"    Disk Size: {primary_model.disk_size_gb} GB")
            print(f"    RAM Requirement: {primary_model.ram_requirement_gb} GB")
            print(f"    Description: {primary_model.description}")
        
        print(f"\nAI Profiles Available:")
        for profile_name, profile_data in recommendations['profiles'].items():
            print(f"  {profile_data['name']}:")
            print(f"    Description: {profile_data['description']}")
            if 'recommended_model' in profile_data:
                print(f"    Recommended Model: {profile_data['recommended_model']}")
            elif 'recommended_models' in profile_data:
                print(f"    Recommended Models: {', '.join(profile_data['recommended_models'])}")
            print(f"    Configuration: {profile_data['configuration']}")
            print()
        
        # Show system status
        status = nexus.get_system_status()
        print(f"System Status:")
        print(f"  Initialized: {status['initialized']}")
        print(f"  Privacy Mode: {status['privacy_mode']}")
        print(f"  Sandboxed Execution: {status['sandboxed_execution']}")
        print(f"  Downloaded Models: {status['downloaded_models_count']}")
        print(f"  Active Models: {status['active_models_count']}")
        print(f"  Orchestration Rules: {status['orchestration_rules_count']}")
        print(f"  Trusted Models: {status['trust_store_size']}")
        
        # Run privacy audit
        audit = nexus.run_privacy_audit()
        print(f"\nPrivacy Audit:")
        for check, result in audit.items():
            status_str = "✓" if result else "✗"
            print(f"  {status_str} {check.replace('_', ' ').title()}: {result}")
        
        # Demonstrate task execution
        print(f"\nDemonstrating Task Execution:")
        tasks = [
            ("writing", "Write a short poem about productivity"),
            ("coding", "Explain how to reverse a linked list in Python"),
            ("math", "Calculate the compound interest for $1000 at 5% for 3 years"),
        ]
        
        for task_type, query in tasks:
            response = nexus.execute_task(task_type, query)
            print(f"  {task_type.title()} Task: {response}")
        
        print(f"\n" + "="*60)
        print("QWEN AI NEXUS READY!")
        print("Your local intelligence core is now configured and operational.")
        print("All processing occurs locally on your device - your data remains sovereign.")
        print("="*60)
        
    except Exception as e:
        print(f"Error during initialization: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()