## BannerMan Builder

### 生成页面项目, 由此完成编辑器产出数据的静态化, 隔绝影响和方便部署.

```js
// 由服务接口生成

// 生成项目
app.get('/generate/:id', function(req, res) {
  generate.generate_project(req.params.id);
});

// 构建项目
app.get('/build/:id', function(req, res) {
  generate.generate_page(req.params.id);
});
```

```bash
# 命令行直接生成

bmbuilder -g <id>  # 生成并构建此 id 的页面项目

bmbuilder -b <id>  # 构建此 id 的页面项目

bmbuilder -l       # 列出所有页面项目 id

bmbuilder -d  <id> # 删除此 id 的页面项目
```
