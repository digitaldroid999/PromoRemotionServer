# Remotion Lambda on AWS – Setup

This project can render videos **locally** (default) or on **Remotion Lambda (AWS)**. To use Lambda, do the following.

## 1. One-time AWS setup

### Install CLI (if needed)

You already have `@remotion/lambda` in the project. From the **Remotion-api** directory (or the repo root), run:

```bash
npx remotion lambda policies role
```

Copy the printed JSON and create an IAM policy in AWS:

1. [IAM → Policies → Create policy](https://console.aws.amazon.com/iamv2/home#/policies)
2. **JSON** tab → paste the output → **Next**
3. Name: **`remotion-lambda-policy`** → **Create policy**

Create the **role**:

1. [IAM → Roles → Create role](https://console.aws.amazon.com/iamv2/home#/roles)
2. **Use case**: Lambda → **Next**
3. Attach **remotion-lambda-policy** → **Next**
4. Name: **`remotion-lambda-role`** → **Create role**

Create a **user** (for your app to call Lambda):

1. [IAM → Users → Create user](https://console.aws.amazon.com/iamv2/home#/users)
2. Name e.g. **`remotion-user`**, no console access → **Next**
3. **Add permissions**: “Attach policies directly” – skip for now → **Next** → **Create user**
4. Open the user → **Security credentials** → **Create access key** → Application running on AWS → **Create**
5. Copy **Access key ID** and **Secret access key**.

Add **user policy** (permissions to invoke Lambda, use S3, etc.):

```bash
npx remotion lambda policies user
```

Copy the output → IAM → Users → your user → **Add permissions** → **Create inline policy** → JSON → paste → **Next** → name e.g. **remotion-user-policy** → **Create**.

(Optional) Validate:

```bash
npx remotion lambda policies validate
```

## 2. Deploy Lambda function and site

From the **Remotion-api** directory, set AWS credentials (see step 3 below), then:

**Deploy the render function (once per Remotion version):**

```bash
# Recommended: use a 300–540s timeout so each chunk has time to finish (default is 120s; often too low for image-heavy compositions)
npx remotion lambda functions deploy --timeout=300
```

Max timeout is 900 seconds. If you see "The main function timed out after 119999ms" or "chunks are missing", redeploy with a higher `--timeout` (e.g. 300 or 540).

Note the **function name** (e.g. `remotion-render-xxxx`). You can also leave it unset and let the app discover it.

**Deploy your Remotion project as a “site” (entry point is the Remotion app):**

From the **Remotion-api** folder, the Remotion app lives at `../Remotion` (or `../../../Remotion` from `src/render`). Run either:

```bash
# from Remotion-api
npx remotion lambda sites create ../Remotion/src/index.ts --site-name=remotion-api-video
```

or, if your Remotion project is at a different path:

```bash
npx remotion lambda sites create /absolute/path/to/Remotion/src/index.ts --site-name=remotion-api-video
```

The command prints a **serve URL** (e.g. `https://remotionlambda-xxx.s3.region.amazonaws.com/sites/yyyy`). You need this in `.env`.

## 3. Environment variables

Add to your `.env` (or set in your environment):

```env
# Enable Lambda rendering (omit or false = local rendering)
REMOTION_USE_LAMBDA=true

# AWS credentials (required for Lambda)
REMOTION_AWS_ACCESS_KEY_ID=AKIA...
REMOTION_AWS_SECRET_ACCESS_KEY=...

# AWS region (same region where you deployed the function and site)
REMOTION_AWS_REGION=us-east-1

# Serve URL from "remotion lambda sites create" (required when using Lambda)
REMOTION_SERVE_URL=https://remotionlambda-xxx.s3.us-east-1.amazonaws.com/sites/yyyy

# Optional: Lambda function name (if not set, a compatible function is auto-selected)
# REMOTION_LAMBDA_FUNCTION_NAME=remotion-render-xxxx

# Optional: Frames per Lambda (default 180). Increase when your account concurrency limit is raised.
# Lower = more parallel Lambdas = faster but needs higher quota. New accounts often have limit 10.
# REMOTION_FRAMES_PER_LAMBDA=180
```

- **REMOTION_USE_LAMBDA**: set to `true` (or `1`) to use Lambda; otherwise rendering stays **local**.
- **REMOTION_SERVE_URL**: required when using Lambda; from step 2.
- **REMOTION_LAMBDA_FUNCTION_NAME**: optional; if omitted, the app uses `getFunctions({ compatibleOnly: true })` to pick a function.
- **REMOTION_FRAMES_PER_LAMBDA**: optional; default `180`. Use a higher value (e.g. 180–300) if you hit "Rate Exceeded" / concurrency limit on new AWS accounts.

## 4. Redeploying after changes

- **Remotion or template changes**: redeploy the **site** with the same `--site-name` so the serve URL does not change:
  ```bash
  npx remotion lambda sites create ../Remotion/src/index.ts --site-name=remotion-api-video
  ```
- **Remotion package upgrade** or **timeout too low**: redeploy the **function** (use same `--timeout` as above if you increased it):
  ```bash
  npx remotion lambda functions deploy --timeout=300
  ```

## 5. "Main function timed out" / chunks missing

If you see **"The main function timed out after 119999ms"** or **"The following chunks are missing"**, the Lambda function’s timeout (default 120s) is too low for the work per chunk.

- **Fix:** Redeploy the function with a higher timeout (AWS max 900s):
  ```bash
  npx remotion lambda functions deploy --timeout=300
  ```
  Or 540 if your compositions are heavy. After redeploy, new renders will use the new timeout.
- **Optional workaround** (if you can’t redeploy yet): lower `REMOTION_FRAMES_PER_LAMBDA` (e.g. 60) so each chunk does less work and might finish in 120s. That uses more concurrent Lambdas, so stay within your account concurrency limit.

## 6. Concurrency and quotas

- Check your limit: `npx remotion lambda quotas`
- **New AWS accounts** often have a very low concurrency limit (e.g. 10 functions total). You’ll see "Rate Exceeded" if a render tries to use more Lambdas than allowed.
- **Immediate fix:** the app uses `framesPerLambda: 180` by default (configurable via `REMOTION_FRAMES_PER_LAMBDA`). That keeps total Lambdas low: e.g. 1 orchestrator + (total frames ÷ 180) renderers. For a ~30s @ 30fps video that’s 1 + 5 = 6 functions. Tune the value so `(total frames ÷ REMOTION_FRAMES_PER_LAMBDA) + 1 ≤ your quota`.
- **Long-term:** request a higher "Concurrent executions" quota for Lambda in [AWS Service Quotas](https://console.aws.amazon.com/servicequotas/home) (search for Lambda → Concurrent executions), or run `npx remotion lambda quotas increase` (needs root account).

## Summary

| Step | Action |
|------|--------|
| 1 | Create IAM policy, role, user; attach user policy; create access keys |
| 2 | Run `remotion lambda functions deploy` and `remotion lambda sites create ... --site-name=...` |
| 3 | Set `REMOTION_USE_LAMBDA=true`, `REMOTION_SERVE_URL`, and AWS credentials in `.env` |
| 4 | Restart the API; new renders will use Lambda and the same flow (e.g. upload to Supabase) |

Your existing API and routes (e.g. `POST /videos`, task status, Supabase upload) are unchanged; only the render backend switches from local to Lambda when `REMOTION_USE_LAMBDA` is set.
