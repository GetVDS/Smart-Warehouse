# SSH密钥配置指南 - GitHub仓库访问

## 🔑 生成SSH密钥

### 方法1: 使用ssh-keygen生成新密钥

```bash
# 生成新的SSH密钥对
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"

# 这将生成两个文件：
# ~/.ssh/id_rsa (私钥)
# ~/.ssh/id_rsa.pub (公钥)
```

### 方法2: 使用ed25519算法（推荐）

```bash
# 生成更安全的ED25519密钥
ssh-keygen -t ed25519 -C "your-email@example.com"

# 查看生成的公钥
cat ~/.ssh/id_ed25519.pub
```

## 🔗 添加SSH密钥到GitHub

### 步骤1: 复制公钥

```bash
# 复制公钥到剪贴板
cat ~/.ssh/id_rsa.pub | pbcopy  # macOS
# 或者
cat ~/.ssh/id_rsa.pub | xclip -selection clipboard  # Linux
# 或者手动复制显示的内容
cat ~/.ssh/id_rsa.pub
```

### 步骤2: 在GitHub中添加SSH密钥

1. 登录GitHub账户
2. 点击右上角头像 → Settings
3. 在左侧菜单中选择 "SSH and GPG keys"
4. 点击 "New SSH key"
5. 填写以下信息：
   - **Title**: Smart Warehouse Deployment Key
   - **Key**: 粘贴刚才复制的公钥内容
   - **Key type**: Authentication Key
6. 点击 "Add SSH key"

## 🛠️ 配置本地Git使用SSH

### 方法1: 配置Git远程仓库

```bash
# 进入项目目录
cd Smart-Warehouse

# 添加SSH远程仓库（如果还没有）
git remote add origin git@github.com:GetVDS/Smart-Warehouse.git

# 或者修改现有的远程仓库
git remote set-url origin git@github.com:GetVDS/Smart-Warehouse.git

# 验证远程仓库配置
git remote -v
```

### 方法2: 配置SSH客户端

```bash
# 创建或编辑SSH配置文件
nano ~/.ssh/config

# 添加以下内容：
Host github.com
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_rsa
    IdentitiesOnly yes

# 保存并退出
# Ctrl+X, Y, Enter
```

### 方法3: 测试SSH连接

```bash
# 测试SSH连接到GitHub
ssh -T git@github.com

# 如果成功，会显示：
# Hi username! You've successfully authenticated, but GitHub does not provide shell access.
```

## 🚀 推送代码到GitHub

### 首次推送

```bash
# 添加所有文件到Git
git add .

# 提交更改
git commit -m "feat: 添加SSH密钥配置和部署文档

- 添加SSH密钥配置指南
- 完善部署操作手册
- 更新Git远程仓库配置"

# 推送到GitHub
git push origin main
```

### 后续推送

```bash
# 标准推送流程
git add .
git commit -m "你的提交信息"
git push origin main
```

## 🔧 故障排除

### SSH密钥权限问题

```bash
# 如果遇到权限错误，检查私钥权限
chmod 600 ~/.ssh/id_rsa
chmod 644 ~/.ssh/id_rsa.pub

# 重启SSH服务
sudo systemctl restart sshd  # Linux
# 或者
brew services restart ssh  # macOS
```

### 多个SSH密钥管理

```bash
# 列出所有SSH密钥
ls -la ~/.ssh/

# 使用特定的SSH密钥
ssh -i ~/.ssh/specific_key git@github.com

# 在SSH配置中指定密钥
Host github.com-work
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_rsa_work
    IdentitiesOnly yes
```

### Windows用户配置

#### 使用Git Bash

```bash
# 在Git Bash中生成密钥
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"

# 查看公钥
cat ~/.ssh/id_rsa.pub

# 复制到剪贴板（Git Bash中）
cat ~/.ssh/id_rsa.pub | clip
```

#### 使用PuTTY

1. 下载并安装PuTTY
2. 使用PuTTYgen生成SSH密钥对
3. 保存公钥和私钥文件
4. 将公钥内容复制到GitHub
5. 在PuTTY中配置私钥文件路径

## 🔐 安全最佳实践

### SSH密钥安全

```bash
# 使用强密码保护私钥（可选）
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa_encrypted

# 定期轮换SSH密钥（建议每年一次）
# 使用密码短语保护密钥
# 限制SSH密钥的使用权限
```

### GitHub安全设置

1. **启用双因素认证**（2FA）
2. **使用SSH密钥而非密码**
3. **定期审查SSH密钥列表**
4. **删除不再使用的SSH密钥**
5. **设置IP白名单**（如果需要）

## 📋 检查清单

### SSH配置验证

- [ ] SSH密钥已生成
- [ ] 公钥已添加到GitHub
- [ ] Git远程仓库已配置
- [ ] SSH连接测试成功
- [ ] 代码推送成功

### 部署就绪

- [ ] 环境变量已配置
- [ ] 数据库已初始化
- [ ] 应用部署成功
- [ ] 健康检查通过
- [ ] 监控系统运行正常

---

## 🚨 常见错误及解决方案

### Permission denied (publickey)

**原因**: SSH公钥不匹配或未正确添加到GitHub

**解决方案**:
```bash
# 检查本地公钥
cat ~/.ssh/id_rsa.pub

# 重新添加到GitHub
# 确保复制完整的公钥内容，包括ssh-rsa开头

# 测试连接
ssh -T git@github.com
```

### Host key verification failed

**原因**: 主机密钥验证失败

**解决方案**:
```bash
# 清除已知主机
ssh-keygen -R github.com

# 重新连接
ssh -T git@github.com
```

### Connection timed out

**原因**: 网络连接问题或防火墙阻拦

**解决方案**:
```bash
# 检查网络连接
ping github.com

# 使用HTTP代理（如果需要）
export GIT_PROXY_COMMAND="ssh -o ProxyCommand=nc -X proxy.example.com:8080 %h %p"

# 检查防火墙设置
sudo ufw status
```

---

## 📞 相关资源

- [GitHub SSH文档](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)
- [Git SSH配置](https://git-scm.com/book/en/v2/Git-on-the-Server-The-Protocols-922-and-941/4-8-SSH-and-HTTPS)
- [SSH密钥最佳实践](https://www.ssh.com/academy/ssh-key)

---

**快速命令总结**:
```bash
# 1. 生成SSH密钥
ssh-keygen -t ed25519 -C "your-email@example.com"

# 2. 复制公钥
cat ~/.ssh/id_ed25519.pub

# 3. 添加到GitHub（在网页上操作）

# 4. 配置Git远程仓库
cd Smart-Warehouse
git remote set-url origin git@github.com:GetVDS/Smart-Warehouse.git

# 5. 测试连接
ssh -T git@github.com

# 6. 推送代码
git add .
git commit -m "配置SSH密钥并推送代码"
git push origin main
```

完成SSH配置后，您就可以安全地推送代码到GitHub仓库了！