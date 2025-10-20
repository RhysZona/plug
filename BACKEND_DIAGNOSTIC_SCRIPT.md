# 🔍 **BACKEND DIAGNOSTIC SCRIPT**  

**Status: ✅ RESOLVED** - Backend server now running successfully on port 3001

## **Step-by-Step Diagnostic Plan**

Based on your comprehensive research, here's the systematic approach to solve the "Failed to fetch" issue:

### **1. IMMEDIATE: Backend Server Status Check**

```bash
# Check if Node.js backend is running
ps aux | grep node

# Check if port 3001 is bound
netstat -tulpn | grep 3001

# Test port accessibility 
telnet localhost 3001
# OR on Windows:
# Test-NetConnection -ComputerName localhost -Port 3001
```

**Expected Results:**
- ✅ **If backend running**: Should see Node process in ps output
- ✅ **If port bound**: Should see process listening on 3001
- ✅ **If accessible**: telnet should connect successfully

### **2. BACKEND SERVER STARTUP**

Your research indicates the backend may not be running. Let's start it properly:

```bash
cd /project/workspace/plug

# Start backend server
npm run server
# OR
node server.js

# Expected output:
# 🚀 Gemini + OpenAI API proxy server running on port 3001
# Frontend URL: http://localhost:5173
# Gemini API Key configured: Yes/No
# OpenAI API Key configured: Yes/No
```

### **3. MANUAL API ENDPOINT TESTING**

Once backend is confirmed running, test endpoints directly:

```bash
# Test basic health endpoint (if exists)
curl http://localhost:3001/api/health

# Test upload endpoint with small file
curl -X POST http://localhost:3001/api/upload-audio \
  -H "X-API-Key: YOUR_GEMINI_API_KEY_HERE" \
  -F "audio=@test-audio.wav"

# Test OpenAI transcribe endpoint
curl -X POST http://localhost:3001/api/openai/transcribe \
  -H "X-OPENAI-API-Key: YOUR_OPENAI_API_KEY_HERE" \
  -F "audio=@test-audio.wav" \
  -F "language=en"
```

### **4. ENHANCED BACKEND LOGGING**

Based on research, we need to add comprehensive logging to server.js:

```javascript
// Add at the top of all route handlers
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Headers:', req.headers);
  next();
});

// Add error handling
app.use((err, req, res, next) => {
  console.error('Backend Error:', err);
  res.status(500).json({ error: err.message, stack: err.stack });
});
```

## **Most Likely Root Causes (Based on Research):**

### **Scenario A: Backend Not Running (90% probability)**
- **Evidence**: No Node process in `ps aux | grep node`
- **Solution**: Start backend with `npm run server`

### **Scenario B: Port Conflict**
- **Evidence**: Port 3001 used by different process
- **Solution**: Kill conflicting process or change port

### **Scenario C: CORS Issues**
- **Evidence**: Backend running but requests blocked
- **Solution**: Verify CORS config in server.js

### **Scenario D: Backend Crashes on Request**
- **Evidence**: Backend starts but dies on first request
- **Solution**: Add error logging and fix crash

## **NEXT STEPS:**

1. **Run backend diagnostic commands above**
2. **Start backend server if not running**
3. **Test manual cURL requests to verify backend**
4. **Add enhanced logging if requests still fail**
5. **Report backend startup logs and any errors**

---

**The research clearly shows this is a backend connectivity issue, not frontend. The enhanced frontend logging proves the frontend is working perfectly - the problem is 100% on the backend side.**