# MongoDB Connection Configuration

## ✅ Aapka MongoDB Connection String:

```
mongodb+srv://backo_project:backo_project@cluster0.zjlt5bq.mongodb.net/backo_db?retryWrites=true&w=majority
```

## 📝 Vercel Me Kaise Add Karein:

1. Vercel Dashboard par jao
2. Aapke backend project me jao
3. Settings → Environment Variables
4. Add karein:
   - **Key:** `MONGODB_URI`
   - **Value:** `mongodb+srv://backo_project:backo_project@cluster0.zjlt5bq.mongodb.net/backo_db?retryWrites=true&w=majority`
   - **Environment:** Production, Preview, Development (sab me add karein)

## ⚠️ Important:

- Database name: `backo_db` (agar aapko different name chahiye to change kar sakte hain)
- Username: `backo_project`
- Password: `backo_project`
- Cluster: `cluster0.zjlt5bq.mongodb.net`

## 🔒 Security Note:

Production me strong password use karein. Abhi yeh development/testing ke liye hai.

## ✅ Test Karein:

Deployment ke baad backend health check:
```
https://your-backend.vercel.app/api/health
```

Agar database connect ho gaya to response me "Server is running" dikhega.

