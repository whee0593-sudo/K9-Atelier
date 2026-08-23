# 管理员账户

> 网站界面是英文。这份说明给 Penny / 内部用。

**最高权限（Owner）：** `penny@k9atelier.com`  
只有这个邮箱可以添加、确认、停用其他管理员。不能删除或降级这个账户。

添加新管理员的流程：

1. Penny 用自己的邮箱登录后台
2. 打开 **Admin Team**
3. 输入对方邮箱，点 **Add admin**（此时还不能进后台）
4. 再点 **Confirm** 才会开通
5. 对方会收到英文确认邮件，从 `/login?next=/admin` 登录

---

## 在 Supabase 跑 SQL（必须）

打开 [Supabase SQL Editor](https://supabase.com/dashboard)，执行 `supabase/migrations/20260823010000_staff_owner_and_invites.sql`。

这会：

- 把 `penny@k9atelier.com` 设为 owner
- 给已有员工补上角色和状态
- 建立待确认的管理员邀请表

若提示 column / table already exists，说明以前跑过，可以忽略。
