import { HttpResponse, http } from 'msw'
import { db } from '@db/auth/db'

// Handlers for auth
export const handlerAuth = [
  http.post(('/api/auth/login'), async ({ request }) => {
    const { email, password } = await request.json()
    let errors = {
      email: ['Something went wrong'],
    }
    const user = db.users.find(u => u.email === email && u.password === password)
    if (user) {
      try {
        const accessToken = db.userTokens[user.id]

        // We are duplicating user here
        const userData = { ...user }

        const userOutData = Object.fromEntries(Object.entries(userData)
          .filter(([key, _]) => !(key === 'password' || key === 'abilityRules')))

        const response = {
          userAbilityRules: userData.abilityRules,
          accessToken,
          userData: userOutData,
        }

        return HttpResponse.json(response, { status: 201 })
      }
      catch (e) {
        errors = { email: [e] }
      }
    }
    else {
      errors = { email: ['Invalid email or password'] }
    }
    
    return HttpResponse.json({ errors }, { status: 400 })
  }),

  /** 与正式接口一致：账号 + 密码（本地开发用） */
  http.post('/api/user/login', async ({ request }) => {
    const body = await request.json()
    const account = body.account ?? body.username ?? body.email
    const { password } = body

    const user = db.users.find(
      u =>
        u.password === password
        && (u.username === account || u.email === account),
    )

    if (!user) {
      return HttpResponse.json(
        { code: 0, msg: '账号或密码错误' },
        { status: 400 },
      )
    }

    const accessToken = db.userTokens[user.id]
    const userData = { ...user }

    const userOutData = Object.fromEntries(
      Object.entries(userData).filter(([key]) => key !== 'password' && key !== 'abilityRules'),
    )

    return HttpResponse.json({
      code: 1,
      msg: '登录成功',
      data: {
        userinfo: {
          ...userOutData,
          token: accessToken,
        },
      },
    })
  }),
]
