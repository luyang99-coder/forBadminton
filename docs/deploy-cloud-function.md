# Deploy Cloud Function

The mini program uses the cloud function `activityService` for cloud sync, QR code generation, and multi-user signup.

## Before Deploying

- `app.js` cloud env: `cloud1-d3gt5f02n0ddacfb3`
- Cloud function root: `cloudfunctions/`
- Function directory: `cloudfunctions/activityService`
- Runtime dependency is installed and locked in `package-lock.json`.

## WeChat DevTools Steps

1. Open this project in WeChat DevTools with AppID `wx46db5d61e7b61d45`.
2. Confirm Cloud Development is enabled for env `cloud1-d3gt5f02n0ddacfb3`.
3. In the left file tree, right-click `cloudfunctions/activityService`.
4. Choose `上传并部署：云端安装依赖`.
5. After deployment, click `云开发 -> 云函数 -> activityService` and run a test event:

```json
{
  "action": "login",
  "data": {}
}
```

Expected result:

```json
{
  "ok": true,
  "openid": "..."
}
```

## Database

Create the indexes listed in `docs/cloud-indexes.md` for the `activities` collection.
