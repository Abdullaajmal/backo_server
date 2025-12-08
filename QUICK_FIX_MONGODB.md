# MongoDB Connection Quick Fix

## ⚡ Sabse Fast Fix (2 Minutes):

### Step 1: MongoDB Atlas Me Jao
1. Open: https://cloud.mongodb.com
2. Login karo

### Step 2: Cluster Check Karo
1. **Cluster0** par click karo
2. **Status check karo:**
   - Agar **"Paused"** hai → **"Resume"** button click karo
   - **"Active"** hona chahiye (green indicator)

### Step 3: Connection String Get Karo
1. **"Connect"** button click karo
2. **"Connect your application"** select karo
3. **"Node.js"** version select karo (4.1+)
4. Connection string **copy** karo

### Step 4: Database Name Add Karo
Connection string me `/backo` add karo:

**Before:**
```
mongodb+srv://user:pass@cluster0.zjlt5bq.mongodb.net/?retryWrites=true&w=majority
```

**After (database name add karo):**
```
mongodb+srv://user:pass@cluster0.zjlt5bq.mongodb.net/backo?retryWrites=true&w=majority
                                                       ↑ yahan /backo
```

### Step 5: .env File Me Paste Karo
```bash
cd backo_server
# .env file open karo
# MONGODB_URI= paste karo connection string
```

### Step 6: Server Restart
```bash
npm run dev
```

---

## ✅ Success Ka Sign:

```
✅ MongoDB Connected Successfully!
   Host: cluster0-shard-00-00.zjlt5bq.mongodb.net
   Database: backo
   Ready State: 1 (1 = connected)
✅ Server running in development mode on port 5000
```

---

## 🔴 Agar Abhi Bhi Error Aaye:

### Error: Authentication Failed
- Password me special characters hain? URL encode karo
- Username/password correct hai verify karo

### Error: DNS Resolution Failed
- Internet connection check karo
- Cluster paused hai? Resume karo
- VPN off karo (if using)

### Error: Connection Timeout
- Internet slow hai? Wait karo
- Cluster pehli baar resume ho raha hai? 2-3 minutes wait karo

---

**2 minutes me fix ho jayega!** 🚀

