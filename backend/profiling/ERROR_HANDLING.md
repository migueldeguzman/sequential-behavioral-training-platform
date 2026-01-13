# Energy Profiler Error Handling Guide

## Overview

This document describes the comprehensive error handling implemented across the Energy Profiler system. All components include proper exception handling, meaningful error messages, and logging for debugging.

## Component Error Handling

### 1. PowerMonitor (power_monitor.py)

#### Permission Errors
- **Error**: `PermissionError` when powermetrics requires password
- **Message**: Includes setup instructions and exact sudoers entry needed
- **Mitigation**: Clear instructions to run setup_powermetrics.sh

#### Process Errors
- **Error**: `RuntimeError` if PowerMonitor already running
- **Message**: "PowerMonitor is already running"
- **Mitigation**: Check `is_running()` before calling `start()`

- **Error**: `FileNotFoundError` if powermetrics not found
- **Message**: Platform-specific guidance (macOS only)
- **Mitigation**: Check `is_available()` class method before instantiation

- **Error**: `RuntimeError` if subprocess terminates immediately
- **Message**: Includes return code and stderr output
- **Mitigation**: Check permissions and system state

#### Parsing Errors
- **Behavior**: Gracefully handled in `_parse_plist_sample()`
- **Action**: Logs warning and continues sampling
- **Result**: No crashes, missing samples are skipped

### 2. ProfileDatabase (database.py)

#### Connection Errors
- **Error**: `sqlite3.OperationalError` for database access issues
- **Message**: Includes path and permission requirements
- **Mitigation**: Ensure write permissions to database directory

- **Error**: `PermissionError` for directory creation
- **Message**: Specific directory path and permission issue
- **Mitigation**: Check filesystem permissions

#### Write Errors
- **Error**: `sqlite3.IntegrityError` for foreign key violations
- **Message**: Identifies which run_id doesn't exist
- **Action**: Automatic rollback to maintain consistency
- **Mitigation**: Ensure run is created before adding child records

- **Error**: `sqlite3.OperationalError` for write failures
- **Action**: Automatic rollback and detailed logging
- **Mitigation**: Check disk space and database integrity

- **Error**: `RuntimeError` if connection not established
- **Message**: "Database connection not established. Call connect() first."
- **Mitigation**: Always call `connect()` before database operations

#### Query Errors
- **Behavior**: Returns `None` for missing records (not exceptions)
- **Methods**: `get_run()`, `get_run_summary()`
- **Result**: Caller can check for `None` and handle gracefully

### 3. InferencePipelineProfiler (pipeline_profiler.py)

#### Power Monitoring Errors
- **Behavior**: Caught in `run()` context manager
- **Action**: Logs error, continues profiling without power data
- **Result**: Partial profiling data still collected

#### Layer Profiler Errors
- **Behavior**: Caught during hook registration and detachment
- **Action**: Logs error, continues with remaining profiling
- **Result**: May miss layer metrics but won't crash inference

#### Deep Profiler Errors
- **Behavior**: Caught during patch/unpatch operations
- **Action**: Logs error, falls back to module-level profiling
- **Result**: No deep metrics but inference continues

#### Database Save Errors
- **Behavior**: Caught in finally block of `run()` context manager
- **Action**: Logs detailed error message
- **Result**: Profiling completes but data may not be saved
- **Mitigation**: Check database connection before profiling session

#### WebSocket Callback Errors
- **Behavior**: Each callback wrapped in try-except
- **Action**: Logs error, continues with next event
- **Result**: One failed callback doesn't break profiling stream

### 4. Model Loading and Inference

The InferencePipelineProfiler is agnostic to model loading - it profiles whatever you pass it. Model loading errors should be handled by the calling code before profiling starts.

**Best Practice**:
```python
try:
    model = load_model(model_name)
except Exception as e:
    logger.error(f"Failed to load model: {e}")
    return {"error": f"Model loading failed: {str(e)}"}

# Model loaded successfully, now profile
with profiler.run(prompt, model_name) as session:
    # ... profiling code
```

### 5. WebSocket Disconnections

WebSocket error handling happens at the callback level in `pipeline_profiler.py`:

- **Power Sample Streaming**: Catches exceptions in callback, logs, continues
- **Section Events**: Catches exceptions in callback, logs, continues
- **Token Complete Events**: Catches exceptions in callback, logs, continues
- **Layer/Component Metrics**: Catches exceptions in callback, logs, continues
- **Inference Complete**: Catches exceptions in callback, logs error

**Result**: Client disconnections don't crash the profiling session. Server continues collecting data and attempting to stream.

## Error Recovery Strategies

### Automatic Recovery

1. **Sampling Thread Errors**: Logged, thread may exit, but main profiling continues
2. **Parse Errors**: Skip bad sample, continue with next
3. **Callback Errors**: Skip failed callback, continue with next event
4. **Hook Errors**: Log error, continue with remaining hooks

### Manual Recovery Required

1. **Permission Errors**: User must configure sudoers
2. **Database Connection Errors**: User must fix permissions or path
3. **Model Loading Errors**: User must fix model path or configuration

### Partial Data Collection

The profiler is designed to collect as much data as possible even when errors occur:

- If power monitoring fails: Still collect layer metrics
- If layer profiler fails: Still collect power samples
- If database save fails: Data still in memory (check logs)
- If WebSocket fails: Data still saved to database

## Logging

All components use Python's `logging` module:

- **Level**: INFO for important events, DEBUG for detailed trace, ERROR for failures
- **Format**: Structured with component name, message, and context
- **Output**: Standard output (can be redirected to file)

### Key Log Messages

```
INFO: "Connected to profiling database at {path}"
INFO: "PowerMonitor started successfully with {interval}ms sampling interval"
INFO: "Starting profiling run {run_id} for model {model_name}"
INFO: "Profiling run {run_id} saved to database"

ERROR: "Failed to start power monitoring: {error}"
ERROR: "Failed to register layer profiler hooks: {error}"
ERROR: "Failed to save run to database: {error}"
ERROR: "Database connection failed: {error}"

DEBUG: "Captured {count} layer timings during prefill"
DEBUG: "Added {count} power samples for run {run_id}"
```

## Best Practices for Calling Code

### 1. Check Availability Before Starting

```python
if not PowerMonitor.is_available():
    raise RuntimeError("powermetrics not available")
```

### 2. Handle Profiler Initialization Errors

```python
try:
    db = ProfileDatabase()
    db.connect()
    profiler = InferencePipelineProfiler(database=db, ...)
except Exception as e:
    logger.error(f"Profiler initialization failed: {e}")
    # Return error to user or use fallback
```

### 3. Wrap Profiling Sessions

```python
try:
    with profiler.run(prompt, model_name) as session:
        # ... inference code
    logger.info("Profiling completed successfully")
except PermissionError as e:
    return {"error": "powermetrics permission denied", "details": str(e)}
except RuntimeError as e:
    return {"error": "profiling failed", "details": str(e)}
except Exception as e:
    logger.error(f"Unexpected profiling error: {e}")
    return {"error": "unexpected error", "details": str(e)}
```

### 4. Validate Database Connection

```python
if not db.conn:
    logger.error("Database connection lost")
    # Reconnect or return error
    db.connect()
```

### 5. Handle WebSocket Disconnections

```python
async def websocket_endpoint(websocket: WebSocket):
    try:
        await websocket.accept()
        # ... profiling with callbacks
    except WebSocketDisconnect:
        logger.info("Client disconnected")
        # Cleanup if needed
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close()
```

## Testing Error Handling

### Test Scenarios

1. **No sudo access**: Verify clear error message
2. **Database directory not writable**: Verify permission error
3. **Client disconnects mid-profiling**: Verify profiling continues
4. **Model loading fails**: Verify caller handles before profiling
5. **Disk full during database write**: Verify rollback and error message
6. **Power monitoring crashes**: Verify partial data collection

### Manual Testing

```bash
# Test permission error
sudo chmod 600 /usr/bin/powermetrics
python -c "from backend.profiling import PowerMonitor; PowerMonitor().start()"

# Test database permission error
mkdir -p /tmp/readonly && chmod 400 /tmp/readonly
python -c "from backend.profiling import ProfileDatabase; ProfileDatabase('/tmp/readonly/test.db').connect()"

# Test graceful degradation
# (Remove powermetrics from sudoers and verify profiling still works without power data)
```

## Error Message Guidelines

All error messages follow these principles:

1. **Descriptive**: Explain what went wrong
2. **Actionable**: Provide steps to fix the issue
3. **Contextual**: Include relevant values (paths, IDs, etc.)
4. **User-friendly**: Avoid technical jargon when possible

**Good Example**:
```
"powermetrics requires passwordless sudo access. Run setup_powermetrics.sh
or add this line to /etc/sudoers.d/powermetrics:
username ALL=(ALL) NOPASSWD: /usr/bin/powermetrics"
```

**Bad Example**:
```
"Permission denied"
```

## Future Improvements

Potential enhancements for error handling:

1. Retry logic for transient database errors
2. Automatic reconnection for WebSocket streams
3. Health check endpoint to verify all components
4. Error metrics collection and alerting
5. Graceful fallback to file-based storage if database fails
6. Circuit breaker pattern for repeated failures
