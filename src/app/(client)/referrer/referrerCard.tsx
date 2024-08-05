'use client'
import React, { useEffect, useState } from 'react'

export default function ReferrerCard() {
  const [cameFromInstagram, setCameFromInstagram] = useState<boolean | null>(null);

  useEffect(() => {
    const checkReferrer = async () => {
      try {
        const response = await fetch('/api/check-referrer');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const data = await response.json();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        setCameFromInstagram(data.cameFromInstagram);
      } catch (error) {
        console.error('Error checking referrer:', error);
      }
    };

    void checkReferrer();
  }, []);
  return (
    <div className='mx-24 text-5xl'>
      {cameFromInstagram === null ? (
        <p>Checking referrer...</p>
      ) : cameFromInstagram ? (
        <p>Usuario veio do Instagram</p>
      ) : (
        <p>Usuario não veio do Instagram</p>
      )}
    </div>
  )
}
