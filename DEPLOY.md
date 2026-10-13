# GrowTime 部署说明

线上地址：**http://43.157.82.151/**

---

## 服务器

| 项 | 值 |
|---|---|
| 类型 | 腾讯云轻量应用服务器（Lighthouse） |
| 实例 ID | `ins-eu1crb7o` |
| 地域 | 法兰克福 `eu-frankfurt-2` |
| 公网 IP | `43.157.82.151` |
| 内网 IP | `10.9.0.9` |
| 系统 | Ubuntu 24.04.4 LTS (x86_64) |
| 登录 | `ubuntu` + 私钥（**仅公钥登录，服务器已禁用密码认证**） |

## 架构

```
浏览器 ──► Caddy :80 ──► /var/www/growtime  (Expo Web 静态产物)
```

- 应用是纯前端 SPA，所有数据存 `AsyncStorage`（浏览器 IndexedDB / localStorage），**服务器不存储任何用户数据**。
- 用 **Caddy** 而不是 nginx：服务器上本来就装了 Caddy 并在跑，直接复用，少装一个组件。
- Caddy 由 systemd 托管，已设开机自启。

## 站点配置

`/etc/caddy/Caddyfile`：

```caddyfile
:80 {
	root * /var/www/growtime
	encode gzip zstd
	try_files {path} /index.html
	file_server

	header {
		Cache-Control "no-cache"
		X-Content-Type-Options nosniff
		Referrer-Policy "strict-origin-when-cross-origin"
		-Server
	}

	header /_expo/static/* Cache-Control "public, max-age=31536000, immutable"
	header /favicon.ico Cache-Control "public, max-age=604800"
}
```

要点：
- `try_files {path} /index.html` —— SPA 回退，刷新任意路径都不会 404
- HTML 不缓存、带哈希的 bundle 强缓存一年 —— 重新发版用户立即拿到新版本，不用清缓存
- gzip 后 bundle 从 1.65MB 降到约 410KB

原始默认配置备份在 `/etc/caddy/Caddyfile.bak.20261011-003243`。

## 重新部署

```bash
cd "C:/Users/Administrator/WorkBuddy/APP/.deploy"
bash deploy.sh
```

脚本会依次：构建 → 清空旧产物 → 上传 → 校验线上响应。

> `env.sh` 里存了服务器地址与私钥路径，**不要提交到版本库**。

## 运维命令

```bash
sudo systemctl status caddy          # 查看状态
sudo systemctl reload caddy          # 改完 Caddyfile 后重载
sudo journalctl -u caddy -n 50       # 查看日志
sudo caddy validate --config /etc/caddy/Caddyfile   # 校验语法
```

临时在本机预览线上文件（绕过安全组）：

```bash
ssh -i <私钥> ubuntu@43.157.82.151 -L 8080:127.0.0.1:80
# 然后浏览器打开 http://localhost:8080
```

## 回滚

```bash
sudo cp /etc/caddy/Caddyfile.bak.20261011-003243 /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

---

## ⚠️ 待办：放行 80 端口

**当前公网无法访问，原因不在服务器，而在腾讯云防火墙。**

已确认：
- 服务器上 Caddy 正常监听 `0.0.0.0:80`，本机 `curl 127.0.0.1` 返回 200
- 服务器 iptables 为 ACCEPT 策略，没有本地拦截
- 从外部对 `43.157.82.151` 做 TCP 探测：**只有 22 端口通，80/443 全部超时**

放行步骤（轻量应用服务器）：

1. 登录 [腾讯云控制台](https://console.cloud.tencent.com/lighthouse)
2. 进入 **轻量应用服务器 → 服务器** → 找到实例 `lh-1359422237-lhins-9wkzybrh`（法兰克福）
3. 点进实例 → **防火墙** 标签页
4. **添加规则**：
   - 应用类型：`HTTP (80)`
   - 协议：`TCP`
   - 端口：`80`
   - 来源：`0.0.0.0/0`
   - 策略：`允许`
5. 保存后立即生效，无需重启服务器

配好后访问 **http://43.157.82.151/** 即可。

### 后续可选

- **HTTPS / 域名**：有域名后把它 A 记录指到 `43.157.82.151`，然后把 Caddyfile 里的 `:80` 改成域名，Caddy 会自动申请并续期 Let's Encrypt 证书。同时需要在防火墙放行 `443`。
- **打包成原生 App**：`npx expo run:android` / EAS Build，见 `README.md`。
