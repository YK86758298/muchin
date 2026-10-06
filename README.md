# PayPal + Supabase 电商模板

这是一个适合新手的电商 starter：
- GitHub Pages：前台网站
- Supabase：商品、订单、管理员登录、Edge Functions
- PayPal：收款
- 后台：`/admin.html` 查看订单

## 目录
- `index.html` 商品首页
- `cart.html` 购物车
- `checkout.html` Checkout + PayPal
- `admin.html` 管理后台
- `app.js` 前台逻辑
- `styles.css` 样式
- `supabase/schema.sql` 数据库
- `supabase/functions/create-paypal-order/index.ts`
- `supabase/functions/capture-paypal-order/index.ts`
- `supabase/functions/paypal-webhook/index.ts`

## 最简单部署路线

### 1. 创建 Supabase
打开 https://supabase.com/ ，注册并创建项目。
进入 SQL Editor，把 `supabase/schema.sql` 全部复制进去执行。

### 2. 建管理员
进入 Supabase > Authentication > Users，创建一个管理员账号。
然后把该用户的 UUID 填入 SQL：
```sql
insert into public.admin_users(user_id) values ('你的用户UUID');
```

### 3. 创建 PayPal App
打开 https://developer.paypal.com/ ，先用 Sandbox 测试。
创建 App，得到：
- Client ID
- Client Secret

Client Secret **绝对不要**放进 GitHub 前端代码。

### 4. 部署 Edge Functions
最省事的方法是：
Supabase Dashboard > Edge Functions > Create function。
把对应文件内容复制进去。
然后在 Supabase > Edge Functions > Secrets 添加：
- PAYPAL_CLIENT_ID
- PAYPAL_CLIENT_SECRET
- PAYPAL_ENV=sandbox
- PAYPAL_WEBHOOK_ID（正式配置 webhook 后再填）

### 5. 修改前端配置
打开 `config.js`：
- SUPABASE_URL = 你的 Supabase Project URL
- SUPABASE_ANON_KEY = 你的 Publishable/Anon key
- PAYPAL_CLIENT_ID = 你的 Sandbox Client ID

注意：这里只放 PayPal Client ID，不放 Secret。

### 6. GitHub
把整个项目上传到一个 GitHub repository。
Settings > Pages > Build and deployment > Source 选择 GitHub Actions。
也可以直接用静态文件部署。

### 7. 修改商品
进入 Supabase > Table Editor > products。
把示例商品改成自己的商品。

## 生产环境
测试成功后：
1. PayPal Sandbox -> Live
2. Edge Function 的 PAYPAL_ENV 改成 live
3. 换成 Live Client ID / Secret
4. 配置 PayPal Webhook
5. 绑定自己的域名
6. 检查退款、库存、税费、运费和隐私政策

这个模板是 starter，不是自动满足所有地区电商法律要求的成品。
