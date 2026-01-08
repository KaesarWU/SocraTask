"""
Hardware Discovery & Profiling Engine for SocraTask AI Nexus

Implements the 90-second diagnostic process to build a "Performance Blueprint"
of the host device, including hardware census, thermal characterization, and
baseline AI benchmarking.
"""
import time
import psutil
import cpuinfo
import platform
import subprocess
import threading
from dataclasses import dataclass
from typing import Dict, Any, Optional
import GPUtil


@dataclass
class HardwareCapabilityVector:
    """Data structure representing the hardware capabilities"""
    architecture: str
    cpu_cores: int
    cpu_threads: int
    cpu_speed: float  # GHz
    ram_gb: float
    gpu_name: Optional[str] = None
    gpu_vram_gb: Optional[float] = None
    storage_tier: str = "Unknown"
    thermal_profile: str = "Unknown"
    special_instructions: list = None


class HardwareProfiler:
    """Comprehensive hardware profiling engine"""
    
    def __init__(self):
        self.capability_vector = None
        self.profiles = {}
        
    def run_full_diagnostic(self, progress_callback=None) -> HardwareCapabilityVector:
        """
        Run the complete 90-second diagnostic process
        """
        print("Starting SocraTask Hardware Diagnostic...")
        
        # Stage 1: Hardware Census (0-30 seconds)
        print("Stage 1: Hardware Census")
        hardware_data = self._hardware_census()
        if progress_callback:
            progress_callback(30, "Hardware census complete")
        
        # Stage 2: Thermal & Power Characterization (31-60 seconds)
        print("Stage 2: Thermal & Power Characterization")
        thermal_data = self._thermal_characterization()
        if progress_callback:
            progress_callback(60, "Thermal characterization complete")
        
        # Stage 3: Baseline AI Benchmarking (61-90 seconds)
        print("Stage 3: Baseline AI Benchmarking")
        benchmark_data = self._baseline_ai_benchmarking()
        if progress_callback:
            progress_callback(90, "Benchmarking complete")
        
        # Combine all data into capability vector
        self.capability_vector = self._create_capability_vector(hardware_data, thermal_data, benchmark_data)
        
        print("Diagnostic complete!")
        return self.capability_vector
    
    def _hardware_census(self) -> Dict[str, Any]:
        """Stage 1: Comprehensive hardware analysis"""
        census_data = {}
        
        # Processor interrogation
        cpu_info = cpuinfo.get_cpu_info()
        census_data['cpu_architecture'] = platform.machine()
        census_data['cpu_vendor'] = cpu_info.get('vendor_id_raw', 'Unknown')
        census_data['cpu_model'] = cpu_info.get('brand_raw', 'Unknown')
        census_data['cpu_cores'] = psutil.cpu_count(logical=False)
        census_data['cpu_threads'] = psutil.cpu_count(logical=True)
        census_data['cpu_max_freq'] = psutil.cpu_freq().max / 1000.0  # GHz
        census_data['special_instructions'] = self._detect_special_instructions()
        
        # Memory mapping
        memory = psutil.virtual_memory()
        census_data['ram_gb'] = round(memory.total / (1024**3), 2)
        
        # GPU identification
        gpus = GPUtil.getGPUs()
        if gpus:
            gpu = gpus[0]  # Primary GPU
            census_data['gpu_name'] = gpu.name
            census_data['gpu_vram_gb'] = round(gpu.memoryTotal / 1024.0, 2)  # Convert MB to GB
            census_data['gpu_driver'] = self._get_gpu_driver()
        else:
            census_data['gpu_name'] = None
            census_data['gpu_vram_gb'] = None
        
        # Storage profiling
        disk_usage = psutil.disk_usage('/')
        census_data['storage_total_gb'] = round(disk_usage.total / (1024**3), 2)
        census_data['storage_free_gb'] = round(disk_usage.free / (1024**3), 2)
        census_data['storage_tier'] = self._assess_storage_tier()
        
        return census_data
    
    def _detect_special_instructions(self) -> list:
        """Detect specialized CPU instruction sets for accelerated tensor operations"""
        instructions = []
        
        # This is a simplified detection - in practice, you'd use more specific methods
        cpu_info = cpuinfo.get_cpu_info()
        flags = cpu_info.get('flags', [])
        
        if 'avx' in flags:
            instructions.append('AVX')
        if 'avx2' in flags:
            instructions.append('AVX2')
        if 'avx512f' in flags:
            instructions.append('AVX-512')
        if 'neon' in flags:
            instructions.append('NEON')
        
        # Additional checks for platform-specific features
        if platform.system() == 'Darwin':  # macOS (Apple Silicon)
            # Apple Silicon has special matrix operations
            instructions.append('AMX')
        
        return instructions
    
    def _assess_storage_tier(self) -> str:
        """Assess storage type (SSD vs HDD) and performance tier"""
        # Simple heuristic: check if disk is likely an SSD
        try:
            # On Linux, check rotational status
            if platform.system() == 'Linux':
                with open('/sys/block/sda/queue/rotational', 'r') as f:
                    is_rotational = f.read().strip() == '1'
                    return 'Slow' if is_rotational else 'Fast'
            # On other systems, use a basic heuristic based on performance
            start_time = time.time()
            # Simple I/O test
            with open('/tmp/storage_test.tmp', 'wb') as f:
                f.write(b'0' * 1024 * 1024)  # 1MB
            write_time = time.time() - start_time
            return 'Fast' if write_time < 0.1 else 'Slow'
        except:
            return 'Unknown'
    
    def _get_gpu_driver(self) -> str:
        """Get GPU driver information"""
        try:
            if platform.system() == 'Windows':
                result = subprocess.run(['nvidia-smi', '--query-gpu=driver_version', '--format=csv,noheader,nounits'], 
                                      capture_output=True, text=True)
                return result.stdout.strip() if result.returncode == 0 else "Unknown"
            elif platform.system() == 'Linux':
                result = subprocess.run(['nvidia-smi', '--query-gpu=driver_version', '--format=csv,noheader,nounits'], 
                                      capture_output=True, text=True)
                return result.stdout.strip() if result.returncode == 0 else "Unknown"
            elif platform.system() == 'Darwin':  # macOS
                return "Metal"
        except:
            return "Unknown"
    
    def _thermal_characterization(self) -> Dict[str, Any]:
        """Stage 2: Thermal and power characterization"""
        thermal_data = {}
        
        # Get initial temperature (if available)
        initial_temp = self._get_system_temperature()
        thermal_data['initial_temp'] = initial_temp
        
        # Run a moderate load test for 20 seconds
        print("Running thermal stress test...")
        start_time = time.time()
        
        # Simple CPU load test
        load_test_thread = threading.Thread(target=self._cpu_load_test, args=(20,))
        load_test_thread.start()
        
        # Monitor temperature during the test
        max_temp = initial_temp if initial_temp else 0
        temp_readings = []
        
        while load_test_thread.is_alive():
            current_temp = self._get_system_temperature()
            if current_temp and current_temp > max_temp:
                max_temp = current_temp
            if current_temp:
                temp_readings.append(current_temp)
            time.sleep(1)
        
        end_time = time.time()
        thermal_data['test_duration'] = end_time - start_time
        thermal_data['max_temp'] = max_temp
        thermal_data['temp_delta'] = max_temp - (initial_temp or 0)
        thermal_data['temp_readings'] = temp_readings
        
        # Assess thermal profile based on results
        if thermal_data['temp_delta'] < 10:
            thermal_profile = "Excellent"
        elif thermal_data['temp_delta'] < 20:
            thermal_profile = "Good"
        elif thermal_data['temp_delta'] < 30:
            thermal_profile = "Balanced"
        else:
            thermal_profile = "Limited"
        
        thermal_data['thermal_profile'] = thermal_profile
        
        return thermal_data
    
    def _get_system_temperature(self) -> Optional[float]:
        """Get system temperature if available"""
        try:
            # Different systems have different temperature sources
            if platform.system() == 'Linux':
                # Try to get CPU temperature from common sensors
                import os
                if os.path.exists('/sys/class/thermal/thermal_zone0/temp'):
                    with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
                        temp = float(f.read().strip()) / 1000.0
                        return temp
            elif platform.system() == 'Darwin':  # macOS
                # Use 'sensors' command if available (requires installation)
                result = subprocess.run(['osx-cpu-temp'], capture_output=True, text=True)
                if result.returncode == 0:
                    temp_str = result.stdout.strip().replace('°C', '')
                    return float(temp_str)
            elif platform.system() == 'Windows':
                # Windows temperature detection is complex and may require WMI or other tools
                pass
        except:
            pass  # Return None if temperature detection fails
        return None
    
    def _cpu_load_test(self, duration: int):
        """Run a CPU load test for specified duration"""
        start = time.time()
        while time.time() - start < duration:
            # Perform CPU-intensive operation
            sum(i * i for i in range(1000))
    
    def _baseline_ai_benchmarking(self) -> Dict[str, Any]:
        """Stage 3: Baseline AI benchmarking with a small probe model"""
        benchmark_data = {}
        
        print("Running baseline AI benchmarks...")
        
        # Simulate AI benchmarking (since we don't have a real model yet)
        # In a real implementation, this would run actual inference tasks
        
        # Latency test simulation
        start_time = time.time()
        # Simulate a simple inference task
        latency_result = self._simulate_inference_task()
        latency_time = time.time() - start_time
        benchmark_data['latency_ms_per_token'] = latency_time * 1000  # Convert to milliseconds
        
        # Memory pressure test simulation
        memory_start = psutil.Process().memory_info().rss
        memory_result = self._simulate_memory_pressure_task()
        memory_end = psutil.Process().memory_info().rss
        benchmark_data['memory_pressure_mb'] = (memory_end - memory_start) / (1024 * 1024)
        
        # Parallelism test simulation
        parallel_start = time.time()
        # Simulate running AI while UI interaction occurs
        parallel_result = self._simulate_parallel_task()
        parallel_time = time.time() - parallel_start
        benchmark_data['parallel_performance'] = parallel_time
        
        benchmark_data['overall_score'] = self._calculate_overall_score(
            benchmark_data['latency_ms_per_token'],
            benchmark_data['memory_pressure_mb'],
            benchmark_data['parallel_performance']
        )
        
        return benchmark_data
    
    def _simulate_inference_task(self):
        """Simulate a simple AI inference task"""
        # This is a placeholder for actual model inference
        time.sleep(0.1)  # Simulate processing time
        return {"result": "simulated_inference", "tokens": 10}
    
    def _simulate_memory_pressure_task(self):
        """Simulate a memory-intensive task"""
        # Create a large list to increase memory usage
        large_list = [i for i in range(100000)]
        time.sleep(0.05)
        return sum(large_list)  # Use the list to prevent garbage collection
    
    def _simulate_parallel_task(self):
        """Simulate running AI tasks in parallel with UI operations"""
        # Simulate concurrent operations
        time.sleep(0.05)
        return {"parallel_result": "success"}
    
    def _calculate_overall_score(self, latency, memory_pressure, parallel_time) -> float:
        """Calculate an overall performance score"""
        # Normalize the values to a 0-100 scale
        # Lower latency = higher score
        latency_score = max(0, 100 - (latency / 10))  # Assume 1000ms = 0 score
        # Lower memory pressure = higher score
        memory_score = max(0, 100 - (memory_pressure / 10))  # Assume 1000MB = 0 score
        # Lower parallel time = higher score
        parallel_score = max(0, 100 - (parallel_time * 1000))  # Convert to ms scale
        
        # Weighted average
        overall_score = (latency_score * 0.4) + (memory_score * 0.3) + (parallel_score * 0.3)
        return min(100, max(0, overall_score))  # Clamp between 0 and 100
    
    def _create_capability_vector(self, hardware_data, thermal_data, benchmark_data) -> HardwareCapabilityVector:
        """Create the final capability vector from all collected data"""
        return HardwareCapabilityVector(
            architecture=hardware_data['cpu_architecture'],
            cpu_cores=hardware_data['cpu_cores'],
            cpu_threads=hardware_data['cpu_threads'],
            cpu_speed=hardware_data['cpu_max_freq'],
            ram_gb=hardware_data['ram_gb'],
            gpu_name=hardware_data['gpu_name'],
            gpu_vram_gb=hardware_data['gpu_vram_gb'],
            storage_tier=hardware_data['storage_tier'],
            thermal_profile=thermal_data['thermal_profile'],
            special_instructions=hardware_data['special_instructions']
        )
    
    def get_recommendations(self, capability_vector: HardwareCapabilityVector) -> Dict[str, str]:
        """Generate AI model recommendations based on the capability vector"""
        recommendations = {}
        
        # Determine recommended model based on hardware specs
        if capability_vector.ram_gb >= 32 and capability_vector.gpu_vram_gb and capability_vector.gpu_vram_gb >= 8:
            recommendations['primary_model'] = 'Qwen2.5-32B (Q8_0)'
            recommendations['gpu_layers'] = 'All layers'
            recommendations['strategy'] = 'Power User - Full GPU acceleration'
        elif capability_vector.ram_gb >= 16 and capability_vector.gpu_vram_gb and capability_vector.gpu_vram_gb >= 4:
            recommendations['primary_model'] = 'Qwen2.5-7B (Q6_K)'
            recommendations['gpu_layers'] = '20-30 layers'
            recommendations['strategy'] = 'Balanced Performance'
        elif capability_vector.ram_gb >= 8:
            recommendations['primary_model'] = 'Qwen2.5-1.5B (Q4_K_M)'
            recommendations['gpu_layers'] = '5-10 layers if GPU available'
            recommendations['strategy'] = 'Efficient Operation'
        else:
            recommendations['primary_model'] = 'Qwen2.5-0.5B (IQ4_XS)'
            recommendations['gpu_layers'] = 'None (CPU only)'
            recommendations['strategy'] = 'Minimal Resource Usage'
        
        # Generate AI profiles
        profiles = {
            'balanced_daily_driver': f"Qwen2.5-7B (Q6_K) for all tasks",
            'specialist_ensemble': "Multiple smaller models (Coder, Math, General) with automatic routing",
            'speed_demon': "Tiny model (0.5B) for instant responses, with option for larger models",
            'power_user_config': "Manual control for advanced users"
        }
        recommendations['profiles'] = profiles
        
        return recommendations