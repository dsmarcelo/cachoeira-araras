'use client'
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { login } from '../lib'

export default function PasswordLoginForm() {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  async function setUserCookie() {
    const res = await login(password)
    if (!res) {
      setMessage('Senha incorreta')
      return
    }
    return res
  }

  return (
    <form action={setUserCookie} className='flex flex-col px-6 mt-6 gap-4 max-w-2xl'>
      <Input
        id="password"
        placeholder="Senha"
        type="password"
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button type='submit' className="w-full">
        Entrar
      </Button>
      {<p className='text-red-500 text-sm'>{message}</p>}
    </form>
  )
}
