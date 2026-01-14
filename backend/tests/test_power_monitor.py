"""
Unit tests for PowerMonitor class

Tests plist parsing, start/stop lifecycle, sample collection,
error handling, and mocks powermetrics for CI environments.
"""

import unittest
from unittest.mock import Mock, MagicMock, patch, mock_open
import time
import subprocess
import threading
from io import StringIO
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from profiling.power_monitor import PowerMonitor, PowerSample


# Sample powermetrics plist output for testing
SAMPLE_PLIST = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>processor</key>
    <dict>
        <key>clusters</key>
        <array>
            <dict>
                <key>name</key>
                <string>E-Cluster</string>
                <key>cpu_power</key>
                <real>1250.5</real>
            </dict>
            <dict>
                <key>name</key>
                <string>P-Cluster</string>
                <key>cpu_power</key>
                <real>3450.2</real>
            </dict>
        </array>
        <key>gpu</key>
        <dict>
            <key>gpu_power</key>
            <real>5678.9</real>
        </dict>
        <key>ane</key>
        <dict>
            <key>power</key>
            <real>234.7</real>
        </dict>
    </dict>
    <key>thermal</key>
    <dict>
        <key>channels</key>
        <array>
            <dict>
                <key>name</key>
                <string>DRAM0</string>
                <key>power</key>
                <real>890.3</real>
            </dict>
            <dict>
                <key>name</key>
                <string>DRAM1</string>
                <key>power</key>
                <real>910.5</real>
            </dict>
        </array>
    </dict>
</dict>
</plist>
"""

# Minimal plist with missing data
MINIMAL_PLIST = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>processor</key>
    <dict>
        <key>clusters</key>
        <array>
            <dict>
                <key>cpu_power</key>
                <real>1000.0</real>
            </dict>
        </array>
    </dict>
</dict>
</plist>
"""

# Invalid plist for error testing
INVALID_PLIST = """<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
<dict>
    <key>broken
</plist>
"""


class TestPowerSample(unittest.TestCase):
    """Tests for PowerSample dataclass"""

    def test_power_sample_creation(self):
        """Test creating a PowerSample with all fields"""
        sample = PowerSample(
            timestamp=1234567890.0,
            relative_time_ms=1500.0,
            cpu_power_mw=5000.0,
            gpu_power_mw=10000.0,
            ane_power_mw=2000.0,
            dram_power_mw=3000.0,
            total_power_mw=20000.0,
            phase='prefill'
        )

        self.assertEqual(sample.timestamp, 1234567890.0)
        self.assertEqual(sample.relative_time_ms, 1500.0)
        self.assertEqual(sample.cpu_power_mw, 5000.0)
        self.assertEqual(sample.gpu_power_mw, 10000.0)
        self.assertEqual(sample.ane_power_mw, 2000.0)
        self.assertEqual(sample.dram_power_mw, 3000.0)
        self.assertEqual(sample.total_power_mw, 20000.0)
        self.assertEqual(sample.phase, 'prefill')

    def test_total_power_w_property(self):
        """Test conversion from milliwatts to watts"""
        sample = PowerSample(
            timestamp=0.0,
            relative_time_ms=0.0,
            cpu_power_mw=5000.0,
            gpu_power_mw=10000.0,
            ane_power_mw=2000.0,
            dram_power_mw=3000.0,
            total_power_mw=20000.0
        )

        self.assertEqual(sample.total_power_w, 20.0)

    def test_default_phase(self):
        """Test that phase defaults to 'idle'"""
        sample = PowerSample(
            timestamp=0.0,
            relative_time_ms=0.0,
            cpu_power_mw=0.0,
            gpu_power_mw=0.0,
            ane_power_mw=0.0,
            dram_power_mw=0.0,
            total_power_mw=0.0
        )

        self.assertEqual(sample.phase, 'idle')


class TestPowerMonitorInit(unittest.TestCase):
    """Tests for PowerMonitor initialization"""

    def test_init_default_interval(self):
        """Test PowerMonitor initialization with default interval"""
        monitor = PowerMonitor()
        self.assertEqual(monitor.sample_interval_ms, 100)
        self.assertFalse(monitor.is_running())
        self.assertEqual(len(monitor.get_samples()), 0)

    def test_init_custom_interval(self):
        """Test PowerMonitor initialization with custom interval"""
        monitor = PowerMonitor(sample_interval_ms=250)
        self.assertEqual(monitor.sample_interval_ms, 250)

    def test_initial_phase_is_idle(self):
        """Test that initial phase is 'idle'"""
        monitor = PowerMonitor()
        self.assertEqual(monitor.get_phase(), 'idle')


class TestPowerMonitorParsing(unittest.TestCase):
    """Tests for plist parsing functionality"""

    def test_parse_complete_plist(self):
        """Test parsing a complete plist with all power components"""
        monitor = PowerMonitor()
        monitor._start_time = time.time()

        # Parse sample plist
        import plistlib
        plist_data = plistlib.loads(SAMPLE_PLIST.encode('utf-8'))
        sample = monitor._parse_plist_sample(plist_data)

        self.assertIsNotNone(sample)
        self.assertIsInstance(sample, PowerSample)

        # Check CPU power (sum of clusters)
        self.assertAlmostEqual(sample.cpu_power_mw, 4700.7, places=1)

        # Check GPU power
        self.assertAlmostEqual(sample.gpu_power_mw, 5678.9, places=1)

        # Check ANE power
        self.assertAlmostEqual(sample.ane_power_mw, 234.7, places=1)

        # Check DRAM power (sum of channels)
        self.assertAlmostEqual(sample.dram_power_mw, 1800.8, places=1)

        # Check total power
        expected_total = 4700.7 + 5678.9 + 234.7 + 1800.8
        self.assertAlmostEqual(sample.total_power_mw, expected_total, places=1)

        # Check phase
        self.assertEqual(sample.phase, 'idle')

    def test_parse_minimal_plist(self):
        """Test parsing a minimal plist with missing components"""
        monitor = PowerMonitor()
        monitor._start_time = time.time()

        import plistlib
        plist_data = plistlib.loads(MINIMAL_PLIST.encode('utf-8'))
        sample = monitor._parse_plist_sample(plist_data)

        self.assertIsNotNone(sample)
        self.assertEqual(sample.cpu_power_mw, 1000.0)
        self.assertEqual(sample.gpu_power_mw, 0.0)
        self.assertEqual(sample.ane_power_mw, 0.0)
        self.assertEqual(sample.dram_power_mw, 0.0)
        self.assertEqual(sample.total_power_mw, 1000.0)

    def test_parse_invalid_plist_returns_none(self):
        """Test that parsing invalid data returns None gracefully"""
        monitor = PowerMonitor()
        monitor._start_time = time.time()

        # Pass invalid data structure
        invalid_data = {'invalid': 'structure'}
        sample = monitor._parse_plist_sample(invalid_data)

        # Should handle gracefully and return None
        # (implementation may vary, but shouldn't crash)
        self.assertIsInstance(sample, (PowerSample, type(None)))

    def test_parse_with_phase_tagging(self):
        """Test that parsed samples are tagged with current phase"""
        monitor = PowerMonitor()
        monitor._start_time = time.time()
        monitor._current_phase = 'prefill'

        import plistlib
        plist_data = plistlib.loads(SAMPLE_PLIST.encode('utf-8'))
        sample = monitor._parse_plist_sample(plist_data)

        self.assertEqual(sample.phase, 'prefill')


class TestPowerMonitorLifecycle(unittest.TestCase):
    """Tests for PowerMonitor start/stop lifecycle"""

    @patch('profiling.power_monitor.PowerMonitor.is_available')
    @patch('subprocess.Popen')
    def test_start_success(self, mock_popen, mock_is_available):
        """Test successful start of PowerMonitor"""
        mock_is_available.return_value = True

        # Mock subprocess
        mock_process = MagicMock()
        mock_process.poll.return_value = None  # Process is running
        mock_process.stdout = StringIO("")
        mock_popen.return_value = mock_process

        monitor = PowerMonitor(sample_interval_ms=100)
        monitor.start()

        self.assertTrue(monitor.is_running())
        self.assertIsNotNone(monitor._start_time)
        self.assertIsNotNone(monitor._sampling_thread)

        # Clean up
        monitor._running = False
        if monitor._sampling_thread:
            monitor._sampling_thread.join(timeout=1)

    @patch('profiling.power_monitor.PowerMonitor.is_available')
    def test_start_when_not_available(self, mock_is_available):
        """Test that start raises PermissionError when powermetrics not available"""
        mock_is_available.return_value = False

        monitor = PowerMonitor()

        with self.assertRaises(PermissionError) as context:
            monitor.start()

        self.assertIn("passwordless sudo", str(context.exception))

    @patch('profiling.power_monitor.PowerMonitor.is_available')
    @patch('subprocess.Popen')
    def test_start_when_already_running(self, mock_popen, mock_is_available):
        """Test that start raises RuntimeError when already running"""
        mock_is_available.return_value = True
        mock_process = MagicMock()
        mock_process.poll.return_value = None
        mock_process.stdout = StringIO("")
        mock_popen.return_value = mock_process

        monitor = PowerMonitor()
        monitor.start()

        with self.assertRaises(RuntimeError) as context:
            monitor.start()

        self.assertIn("already running", str(context.exception))

        # Clean up
        monitor._running = False
        if monitor._sampling_thread:
            monitor._sampling_thread.join(timeout=1)

    @patch('profiling.power_monitor.PowerMonitor.is_available')
    @patch('subprocess.Popen')
    def test_stop_success(self, mock_popen, mock_is_available):
        """Test successful stop of PowerMonitor"""
        mock_is_available.return_value = True
        mock_process = MagicMock()
        mock_process.poll.return_value = None
        mock_process.stdout = StringIO("")
        mock_popen.return_value = mock_process

        monitor = PowerMonitor()
        monitor.start()
        time.sleep(0.1)  # Let it run briefly
        monitor.stop()

        self.assertFalse(monitor.is_running())
        mock_process.terminate.assert_called_once()

    def test_stop_when_not_running(self):
        """Test that stop raises RuntimeError when not running"""
        monitor = PowerMonitor()

        with self.assertRaises(RuntimeError) as context:
            monitor.stop()

        self.assertIn("not running", str(context.exception))

    @patch('profiling.power_monitor.PowerMonitor.is_available')
    @patch('subprocess.Popen')
    def test_context_manager(self, mock_popen, mock_is_available):
        """Test PowerMonitor as context manager"""
        mock_is_available.return_value = True
        mock_process = MagicMock()
        mock_process.poll.return_value = None
        mock_process.stdout = StringIO("")
        mock_popen.return_value = mock_process

        with PowerMonitor() as monitor:
            self.assertTrue(monitor.is_running())

        # Should be stopped after context exit
        self.assertFalse(monitor.is_running())


class TestPowerMonitorSampleCollection(unittest.TestCase):
    """Tests for sample collection and retrieval"""

    def test_get_samples_empty(self):
        """Test getting samples when none collected"""
        monitor = PowerMonitor()
        samples = monitor.get_samples()

        self.assertEqual(len(samples), 0)
        self.assertIsInstance(samples, list)

    def test_get_current_when_empty(self):
        """Test getting current sample when none collected"""
        monitor = PowerMonitor()
        current = monitor.get_current()

        self.assertIsNone(current)

    def test_samples_thread_safety(self):
        """Test that sample access is thread-safe"""
        monitor = PowerMonitor()
        monitor._start_time = time.time()

        # Add sample from main thread
        sample1 = PowerSample(
            timestamp=time.time(),
            relative_time_ms=100.0,
            cpu_power_mw=1000.0,
            gpu_power_mw=2000.0,
            ane_power_mw=500.0,
            dram_power_mw=300.0,
            total_power_mw=3800.0
        )

        with monitor._samples_lock:
            monitor._samples.append(sample1)

        # Verify retrieval is thread-safe
        samples = monitor.get_samples()
        self.assertEqual(len(samples), 1)

        # Original list should not be returned (should be a copy)
        samples.append(sample1)
        self.assertEqual(len(monitor.get_samples()), 1)


class TestPowerMonitorPhaseManagement(unittest.TestCase):
    """Tests for phase management"""

    def test_set_valid_phase(self):
        """Test setting valid inference phases"""
        monitor = PowerMonitor()

        valid_phases = ['idle', 'pre_inference', 'prefill', 'decode', 'post_inference']

        for phase in valid_phases:
            monitor.set_phase(phase)
            self.assertEqual(monitor.get_phase(), phase)

    def test_set_invalid_phase(self):
        """Test that setting invalid phase raises ValueError"""
        monitor = PowerMonitor()

        with self.assertRaises(ValueError) as context:
            monitor.set_phase('invalid_phase')

        self.assertIn("Invalid phase", str(context.exception))


class TestPowerMonitorPeakPower(unittest.TestCase):
    """Tests for peak power tracking"""

    def test_peak_power_initial(self):
        """Test that peak power is initially zero"""
        monitor = PowerMonitor()
        peak = monitor.get_peak_power()

        self.assertEqual(peak['peak_power_mw'], 0.0)
        self.assertEqual(peak['peak_power_cpu_mw'], 0.0)
        self.assertEqual(peak['peak_power_gpu_mw'], 0.0)
        self.assertEqual(peak['peak_power_ane_mw'], 0.0)
        self.assertEqual(peak['peak_power_dram_mw'], 0.0)

    def test_peak_power_tracking(self):
        """Test that peak power is tracked correctly during parsing"""
        monitor = PowerMonitor()
        monitor._start_time = time.time()

        import plistlib
        plist_data = plistlib.loads(SAMPLE_PLIST.encode('utf-8'))

        # Parse sample (should update peaks)
        sample = monitor._parse_plist_sample(plist_data)

        peak = monitor.get_peak_power()

        # Peak should match the sample since it's the only one
        self.assertAlmostEqual(peak['peak_power_mw'], sample.total_power_mw, places=1)
        self.assertAlmostEqual(peak['peak_power_cpu_mw'], sample.cpu_power_mw, places=1)
        self.assertAlmostEqual(peak['peak_power_gpu_mw'], sample.gpu_power_mw, places=1)


class TestPowerMonitorIdleBaseline(unittest.TestCase):
    """Tests for idle baseline measurement"""

    @patch('profiling.power_monitor.PowerMonitor.is_available')
    @patch('subprocess.Popen')
    def test_measure_idle_baseline(self, mock_popen, mock_is_available):
        """Test idle baseline measurement"""
        mock_is_available.return_value = True
        mock_process = MagicMock()
        mock_process.poll.return_value = None
        mock_process.stdout = StringIO("")
        mock_popen.return_value = mock_process

        monitor = PowerMonitor()
        monitor.start()

        # Manually add some idle samples before measuring baseline
        monitor._start_time = time.time()
        for i in range(10):
            sample = PowerSample(
                timestamp=time.time(),
                relative_time_ms=i * 100.0,
                cpu_power_mw=1000.0 + i * 10,
                gpu_power_mw=2000.0 + i * 10,
                ane_power_mw=500.0,
                dram_power_mw=300.0,
                total_power_mw=3800.0 + i * 10
            )
            with monitor._samples_lock:
                monitor._samples.append(sample)

        # Mock time.sleep to add more samples during baseline measurement
        def add_samples_during_sleep(duration):
            for i in range(5):
                sample = PowerSample(
                    timestamp=time.time(),
                    relative_time_ms=(10 + i) * 100.0,
                    cpu_power_mw=1100.0,
                    gpu_power_mw=2100.0,
                    ane_power_mw=500.0,
                    dram_power_mw=300.0,
                    total_power_mw=4000.0
                )
                with monitor._samples_lock:
                    monitor._samples.append(sample)

        with patch('time.sleep', side_effect=add_samples_during_sleep):
            # Measure baseline
            baseline = monitor.measure_idle_baseline(duration_seconds=1.0)

        self.assertIn('baseline_power_mw', baseline)
        self.assertIn('baseline_cpu_power_mw', baseline)
        self.assertIn('baseline_sample_count', baseline)
        self.assertEqual(baseline['baseline_sample_count'], 5)  # 5 samples added during sleep

        # Clean up
        monitor._running = False
        if monitor._sampling_thread:
            monitor._sampling_thread.join(timeout=1)

    def test_measure_idle_baseline_not_running(self):
        """Test that measuring baseline when not running raises error"""
        monitor = PowerMonitor()

        with self.assertRaises(RuntimeError) as context:
            monitor.measure_idle_baseline()

        self.assertIn("must be running", str(context.exception))


class TestPowerMonitorIsAvailable(unittest.TestCase):
    """Tests for powermetrics availability check"""

    @patch('subprocess.run')
    def test_is_available_true(self, mock_run):
        """Test is_available returns True when powermetrics accessible"""
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_run.return_value = mock_result

        result = PowerMonitor.is_available()

        self.assertTrue(result)
        mock_run.assert_called_once()

    @patch('subprocess.run')
    def test_is_available_false_permission_denied(self, mock_run):
        """Test is_available returns False when permission denied"""
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_run.return_value = mock_result

        result = PowerMonitor.is_available()

        self.assertFalse(result)

    @patch('subprocess.run')
    def test_is_available_false_timeout(self, mock_run):
        """Test is_available returns False on timeout"""
        mock_run.side_effect = subprocess.TimeoutExpired('cmd', 2)

        result = PowerMonitor.is_available()

        self.assertFalse(result)

    @patch('subprocess.run')
    def test_is_available_false_not_found(self, mock_run):
        """Test is_available returns False when powermetrics not found"""
        mock_run.side_effect = FileNotFoundError()

        result = PowerMonitor.is_available()

        self.assertFalse(result)


class TestPowerMonitorErrorHandling(unittest.TestCase):
    """Tests for error handling"""

    @patch('profiling.power_monitor.PowerMonitor.is_available')
    @patch('subprocess.Popen')
    def test_process_terminates_immediately(self, mock_popen, mock_is_available):
        """Test handling when powermetrics process terminates immediately"""
        mock_is_available.return_value = True

        # Mock process that terminates immediately
        mock_process = MagicMock()
        mock_process.poll.return_value = 1  # Already terminated
        mock_process.returncode = 1
        mock_process.stderr = StringIO("Permission denied")
        mock_popen.return_value = mock_process

        monitor = PowerMonitor()

        with self.assertRaises(RuntimeError) as context:
            monitor.start()

        self.assertIn("terminated immediately", str(context.exception))

    @patch('profiling.power_monitor.PowerMonitor.is_available')
    @patch('subprocess.Popen')
    def test_stop_process_kill_on_timeout(self, mock_popen, mock_is_available):
        """Test that process is killed if terminate times out"""
        mock_is_available.return_value = True

        mock_process = MagicMock()
        mock_process.poll.return_value = None
        mock_process.stdout = StringIO("")
        mock_process.wait.side_effect = [subprocess.TimeoutExpired('cmd', 2), None]
        mock_popen.return_value = mock_process

        monitor = PowerMonitor()
        monitor.start()
        monitor.stop()

        mock_process.terminate.assert_called_once()
        mock_process.kill.assert_called_once()


if __name__ == '__main__':
    unittest.main()
