import React, { useEffect, useState } from 'react';
import { Link2, Wallet } from 'lucide-react';
import { createWalletChallenge, getWalletStatus, getErrorMessage, verifyWalletChallenge } from '../services/api';

export default function WalletLink() {
  const [wallet, setWallet] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getWalletStatus().then((res) => setWallet(res.data.walletAddress)).catch(() => {});
  }, []);

  async function linkWallet() {
    setBusy(true);
    setMessage('');
    try {
      if (!window.ethereum) throw new Error('Install or open an EVM wallet such as MetaMask to link a wallet.');
      const [address] = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const { data } = await createWalletChallenge(address);
      const signature = await window.ethereum.request({ method: 'personal_sign', params: [data.message, address] });
      const result = await verifyWalletChallenge({ address, message: data.message, signature });
      setWallet(result.data.walletAddress);
      setMessage('Wallet ownership verified and linked.');
    } catch (err) {
      setMessage(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      {wallet ? (
        <div style={{ fontSize: '0.72rem', color: '#64748b', wordBreak: 'break-all' }}>
          <Wallet size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />Verified wallet: {wallet}
        </div>
      ) : (
        <button className="btn btn-secondary btn-small" onClick={linkWallet} disabled={busy}>
          <Link2 size={13} /> {busy ? 'Verifying…' : 'Link wallet'}
        </button>
      )}
      {message && <div role="status" style={{ marginTop: 6, color: wallet ? '#15803d' : '#b91c1c', fontSize: '0.74rem' }}>{message}</div>}
    </div>
  );
}
