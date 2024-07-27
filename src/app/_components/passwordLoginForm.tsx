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
    <form action={setUserCookie} className='flex flex-col mx-auto w-full px-6 mt-6 mb-auto gap-4 max-w-lg'>
      <h3>Digire a senha para entrar</h3>
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
