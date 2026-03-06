import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Book, 
  Package, 
  Repeat, 
  Store, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  X,
  Trophy,
  Info,
  Printer,
  Settings,
  LayoutGrid,
  ShieldCheck,
  Key,
  Copy,
  Check,
  RefreshCw
} from 'lucide-react';
import { Sticker, CollectionItem, SwapItem } from './types';

export default function App() {
  const getInitialUser = () => {
    const params = new URLSearchParams(window.location.search);
    const urlUser = params.get('user');
    if (urlUser) return urlUser;
    return localStorage.getItem('album_user');
  };

  const [currentUser, setCurrentUser] = useState<string | null>(getInitialUser());
  const [isAdmin, setIsAdmin] = useState<boolean>(localStorage.getItem('album_is_admin') === 'true');
  const [activeTab, setActiveTab] = useState<'album' | 'inventory' | 'market' | 'store' | 'admin'>('album');
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [swapMarket, setSwapMarket] = useState<SwapItem[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isOpeningPack, setIsOpeningPack] = useState(false);
  const [openedPack, setOpenedPack] = useState<Sticker[]>([]);
  const [packCode, setPackCode] = useState('');
  const [adminCodes, setAdminCodes] = useState<any[]>([]);
  const [showPageSelector, setShowPageSelector] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const printTriggered = useRef(false);

  const categories = Array.from(new Set(stickers.map(s => s.category)));

  useEffect(() => {
    if (currentUser) {
      fetchData();
      
      // Check if we should trigger print automatically (for new tab printing)
      const params = new URLSearchParams(window.location.search);
      if (params.get('print') === 'true' && !printTriggered.current) {
        printTriggered.current = true;
        setIsPrinting(true);
        // Small delay to ensure content is rendered
        setTimeout(() => {
          window.print();
          // Close the window after printing
          window.close();
          
          // Fallback for browsers that block window.close()
          window.history.replaceState({}, '', window.location.pathname);
          setIsPrinting(false);
        }, 3000);
      }
    }
  }, [currentUser]);

  const fetchData = async () => {
    if (!currentUser) return;
    
    const headers = { 'user-id': currentUser };
    try {
      const [sRes, cRes, mRes] = await Promise.all([
        fetch('/api/stickers'),
        fetch('/api/collection', { headers }),
        fetch('/api/swap-market')
      ]);
      
      const sData = await sRes.json();
      const cData = await cRes.json();
      const mData = await mRes.json();
      
      setStickers(Array.isArray(sData) ? sData : []);
      setCollection(Array.isArray(cData) ? cData : []);
      setSwapMarket(Array.isArray(mData) ? mData : []);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (loginUsername.trim() && loginPassword.trim()) {
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: loginUsername, password: loginPassword })
        });
        
        const data = await res.json();
        if (res.ok) {
          localStorage.setItem('album_user', data.username);
          localStorage.setItem('album_is_admin', data.isAdmin.toString());
          setCurrentUser(data.username);
          setIsAdmin(data.isAdmin);
        } else {
          setAuthError(data.error || "Erro ao fazer login");
        }
      } catch (error) {
        console.error("Login error:", error);
        setAuthError("Erro ao conectar ao servidor");
      }
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (loginUsername.trim() && loginPassword.trim() && recoveryCode.trim()) {
      try {
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            username: loginUsername, 
            password: loginPassword,
            recoveryCode: recoveryCode
          })
        });
        
        const data = await res.json();
        if (res.ok) {
          alert("Cadastro realizado com sucesso! Agora faça o login.");
          setIsRegistering(false);
          setAuthError(null);
        } else {
          setAuthError(data.error || "Erro ao cadastrar");
        }
      } catch (error) {
        console.error("Register error:", error);
        setAuthError("Erro ao conectar ao servidor");
      }
    } else if (!recoveryCode.trim()) {
      setAuthError("Código de recuperação é obrigatório");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (loginUsername.trim() && loginPassword.trim() && recoveryCode.trim()) {
      try {
        const res = await fetch('/api/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            username: loginUsername, 
            recoveryCode: recoveryCode,
            newPassword: loginPassword
          })
        });
        
        const data = await res.json();
        if (res.ok) {
          alert("Senha resetada com sucesso! Faça o login com a nova senha.");
          setIsResetting(false);
          setAuthError(null);
        } else {
          setAuthError(data.error || "Erro ao resetar senha");
        }
      } catch (error) {
        console.error("Reset error:", error);
        setAuthError("Erro ao conectar ao servidor");
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('album_user');
    setCurrentUser(null);
    setShowSettings(false);
  };

  const openPack = async () => {
    if (!currentUser) return;
    if (!packCode.trim()) {
      alert("Por favor, informe um código válido para abrir o pacote.");
      return;
    }
    setIsOpeningPack(true);
    setOpenedPack([]); // Reset
    setStoreError(null); // Reset error
    
    try {
      if (!navigator.onLine) {
        throw new Error('OFFLINE');
      }
      const startTime = Date.now();
      const res = await fetch('/api/open-pack', { 
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'user-id': currentUser 
        },
        body: JSON.stringify({ code: packCode.trim() })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to open pack');
      
      const pack = data;
      
      // Ensure the shaking animation plays for at least 1.5 seconds
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, 1500 - elapsedTime);
      
      setTimeout(async () => {
        setOpenedPack(pack);
        setPackCode(''); // Clear code
        await fetchData();
      }, remainingTime);
    } catch (error: any) {
      console.error("Error opening pack:", error);
      const errorMsg = error.message === 'OFFLINE' || !navigator.onLine 
        ? "Você está offline! É necessário uma conexão com a internet para abrir novos pacotes."
        : (error.message || "Erro ao abrir pacote. Verifique sua conexão e tente novamente.");
      
      setStoreError(errorMsg);
      setIsOpeningPack(false);
    }
  };

  const fetchAdminCodes = async () => {
    if (!currentUser || !isAdmin) return;
    try {
      const res = await fetch('/api/admin/codes', {
        headers: { 'user-id': currentUser }
      });
      if (res.ok) {
        const data = await res.json();
        setAdminCodes(data);
      }
    } catch (error) {
      console.error("Error fetching admin codes:", error);
    }
  };

  const generatePackCode = async () => {
    if (!currentUser || !isAdmin) return;
    try {
      const res = await fetch('/api/admin/generate-code', {
        method: 'POST',
        headers: { 'user-id': currentUser }
      });
      if (res.ok) {
        await fetchAdminCodes();
      }
    } catch (error) {
      console.error("Error generating code:", error);
    }
  };

  const reactivateCode = async (codeId: number) => {
    if (!currentUser || !isAdmin) return;
    
    try {
      const res = await fetch('/api/admin/reactivate-code', {
        method: 'POST',
        headers: { 
          'user-id': currentUser,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ codeId })
      });
      if (res.ok) {
        await fetchAdminCodes();
      }
    } catch (error) {
      console.error("Error reactivating code:", error);
    }
  };

  useEffect(() => {
    setStoreError(null);
    if (activeTab === 'admin') {
      fetchAdminCodes();
    }
  }, [activeTab]);

  const stickSticker = async (stickerId: number) => {
    if (!currentUser) return;
    await fetch('/api/stick', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'user-id': currentUser
      },
      body: JSON.stringify({ stickerId })
    });
    await fetchData();
  };

  const addToSwap = async (stickerId: number) => {
    if (!currentUser) return;
    const res = await fetch('/api/add-to-swap', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'user-id': currentUser
      },
      body: JSON.stringify({ stickerId })
    });
    if (res.ok) {
      await fetchData();
    } else {
      const data = await res.json();
      alert(data.error || "Erro ao adicionar para troca");
    }
  };

  const claimSwap = async (swapId: number) => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/claim-swap', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'user-id': currentUser
        },
        body: JSON.stringify({ swapId })
      });
      const data = await res.json();
      if (res.ok) {
        alert("Figurinha trocada com sucesso!");
        await fetchData();
      } else {
        alert(data.error || "Erro ao realizar troca");
      }
    } catch (error) {
      console.error("Claim swap error:", error);
      alert("Erro ao conectar ao servidor");
    }
  };

  const currentCategory = categories[currentPage];
  const categoryStickers = stickers.filter(s => s.category === currentCategory);

  const renderAlbum = () => (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <div className="flex items-center justify-between mb-8 bg-black/5 p-4 rounded-2xl backdrop-blur-sm">
        <button 
          onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
          className="p-2 hover:bg-black/10 rounded-full transition-colors"
          disabled={currentPage === 0}
        >
          <ChevronLeft className={currentPage === 0 ? 'opacity-20' : ''} />
        </button>
        
        <div className="text-center cursor-pointer" onClick={() => setShowPageSelector(true)}>
          <h2 className="text-3xl font-bold tracking-tight uppercase italic font-serif">{currentCategory}</h2>
          <p className="text-xs uppercase tracking-widest opacity-50 font-mono">Página {currentPage + 1} de {categories.length}</p>
        </div>

        <button 
          onClick={() => setCurrentPage(prev => Math.min(categories.length - 1, prev + 1))}
          className="p-2 hover:bg-black/10 rounded-full transition-colors"
          disabled={currentPage === categories.length - 1}
        >
          <ChevronRight className={currentPage === categories.length - 1 ? 'opacity-20' : ''} />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
        {categoryStickers.map(sticker => {
          const collected = collection.find(c => c.sticker_id === sticker.id);
          const isStuck = collected?.is_stuck;
          const hasInInventory = collected && collected.quantity > 0 && !isStuck;

          return (
            <div key={sticker.id} className="relative group aspect-[2/3]">
              <div className={`w-full h-full rounded-lg border-2 border-dashed border-black/10 flex items-center justify-center overflow-hidden transition-all duration-500 ${isStuck ? 'border-none shadow-xl scale-105' : 'bg-white/50'}`}>
                {isStuck ? (
                  <motion.img 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    src={sticker.image_url} 
                    alt={sticker.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="text-center p-4">
                    <p className="text-4xl font-bold opacity-10 font-serif italic">{sticker.id}</p>
                    {hasInInventory && (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => stickSticker(sticker.id)}
                        className="mt-2 bg-emerald-500 text-white p-2 rounded-full shadow-lg hover:bg-emerald-600 transition-colors"
                      >
                        <Plus size={20} />
                      </motion.button>
                    )}
                  </div>
                )}
              </div>
              {isStuck && sticker.rarity !== 'comum' && (
                <div className={`absolute -top-2 -right-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter ${sticker.rarity === 'lendária' ? 'bg-amber-400 text-amber-950' : 'bg-indigo-500 text-white'}`}>
                  {sticker.rarity}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderInventory = () => {
    const inventoryItems = collection.filter(c => c.quantity > 0);

    return (
      <div className="max-w-5xl mx-auto p-4 md:p-8">
        {inventoryItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="bg-black/5 p-8 rounded-full mb-6">
              <LayoutGrid size={48} className="opacity-20" />
            </div>
            <h2 className="text-2xl font-serif italic mb-2">Sua mochila está vazia</h2>
            <p className="text-sm opacity-50 max-w-xs mb-8">
              Você ainda não possui figurinhas em seu inventário. Vá até a loja para abrir seus primeiros pacotes!
            </p>
            <button 
              onClick={() => setActiveTab('store')}
              className="bg-amber-400 text-black px-8 py-3 rounded-full font-bold uppercase tracking-widest hover:bg-amber-500 transition-all shadow-lg"
            >
              Ir para a Loja
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {inventoryItems.map(item => (
              <div key={item.id} className="relative group">
                <div className="rounded-lg overflow-hidden shadow-md bg-white">
                  <img src={item.image_url} alt={item.name} className="w-full aspect-[2/3] object-cover" referrerPolicy="no-referrer" />
                  <div className="p-2 bg-white">
                    <p className="text-[10px] font-bold truncate uppercase">{item.name}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-mono bg-black/5 px-1.5 rounded">x{item.quantity}</span>
                      {item.quantity > 1 && (
                        <button 
                          onClick={() => addToSwap(item.sticker_id)}
                          className="text-indigo-600 hover:text-indigo-800"
                          title="Adicionar ao mercado de trocas"
                        >
                          <Repeat size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {item.is_stuck && (
                  <div className="absolute top-1 right-1 bg-emerald-500 text-white rounded-full p-0.5">
                    <Plus size={10} className="rotate-45" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderFullAlbum = () => (
    <div className="bg-white p-8 space-y-12 print:p-0">
      <div className="flex justify-end print:hidden mb-4">
        <button 
          onClick={() => window.close()}
          className="bg-black text-white px-6 py-2 rounded-full font-bold uppercase text-xs tracking-widest hover:bg-red-600 transition-colors"
        >
          Fechar Janela
        </button>
      </div>
      <div className="text-center mb-12 border-b-4 border-black pb-8">
        <h1 className="text-5xl font-bold uppercase italic font-serif mb-2">Álbum de Figurinhas Completo</h1>
        <p className="text-xl font-mono uppercase tracking-widest opacity-60">Coleção de {currentUser}</p>
      </div>

      {categories.map(category => (
        <div key={category} className="page-break-after-always">
          <div className="flex items-center justify-between mb-6 border-b-2 border-black/10 pb-2">
            <h2 className="text-3xl font-bold uppercase italic font-serif">{category}</h2>
          </div>
          
          <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
            {stickers.filter(s => s.category === category).map(sticker => {
              const collected = collection.find(c => c.sticker_id === sticker.id);
              const isStuck = collected?.is_stuck;

              return (
                <div key={sticker.id} className="aspect-[2/3] border-2 border-black/5 rounded-lg overflow-hidden relative bg-gray-50">
                  {isStuck ? (
                    <img 
                      src={sticker.image_url} 
                      alt={sticker.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-2xl font-serif font-bold opacity-10 italic">{sticker.id}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .page-break-after-always { page-break-after: always; }
          body { background: white !important; }
          nav, header, button { display: none !important; }
        }
      `}} />
    </div>
  );

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center"
        >
          <div className="bg-amber-400 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Trophy className="text-black" size={32} />
          </div>
          <h1 className="text-3xl font-bold tracking-tighter uppercase italic font-serif mb-2">
            {isRegistering ? 'Criar Conta' : (isResetting ? 'Resetar Senha' : 'Bem-vindo!')}
          </h1>
          <p className="text-sm opacity-60 mb-8">
            {isRegistering 
              ? 'Cadastre-se para começar sua coleção de figurinhas.' 
              : (isResetting ? 'Informe seu código de recuperação para definir uma nova senha.' : 'Faça o login para acessar seu álbum de figurinhas.')}
          </p>
          
          {authError && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold border border-red-100"
            >
              {authError}
            </motion.div>
          )}

          <form onSubmit={isRegistering ? handleRegister : (isResetting ? handleResetPassword : handleLogin)} className="space-y-4">
            <input 
              type="text" 
              placeholder="Nome de usuário" 
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              className="w-full px-6 py-4 rounded-2xl bg-black/5 border-2 border-transparent focus:border-amber-400 outline-none transition-all font-medium"
              required
            />
            <input 
              type="password" 
              placeholder={isResetting ? "Nova Senha" : "Senha"}
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="w-full px-6 py-4 rounded-2xl bg-black/5 border-2 border-transparent focus:border-amber-400 outline-none transition-all font-medium"
              required
            />
            {(isRegistering || isResetting) && (
              <input 
                type="text" 
                placeholder="Código de Recuperação (ex: 1234)" 
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                className="w-full px-6 py-4 rounded-2xl bg-black/5 border-2 border-transparent focus:border-amber-400 outline-none transition-all font-medium"
                required
              />
            )}
            <button 
              type="submit"
              className="w-full bg-[#141414] text-white py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-black transition-all shadow-xl"
            >
              {isRegistering ? 'Cadastrar' : (isResetting ? 'Redefinir Senha' : 'Entrar no Álbum')}
            </button>
          </form>

          {!isRegistering && !isResetting && (
            <button 
              onClick={() => {
                setIsResetting(true);
                setAuthError(null);
              }}
              className="mt-4 text-[10px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
            >
              Esqueci minha senha
            </button>
          )}

          <div className="mt-6 flex flex-col gap-2">
            <button 
              onClick={() => {
                setIsRegistering(!isRegistering);
                setIsResetting(false);
                setAuthError(null);
              }}
              className="text-xs font-bold uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity"
            >
              {isRegistering ? 'Já tenho uma conta. Fazer login.' : 'Não tenho conta. Cadastrar agora.'}
            </button>
            
            {isResetting && (
              <button 
                onClick={() => {
                  setIsResetting(false);
                  setAuthError(null);
                }}
                className="text-xs font-bold uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity"
              >
                Voltar para o Login
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  if (isPrinting) {
    return renderFullAlbum();
  }

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-emerald-200">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#141414] text-[#E4E3E0] px-6 py-4 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="bg-amber-400 p-1.5 rounded-md">
            <Trophy className="text-black" size={20} />
          </div>
          <h1 className="text-xl font-bold tracking-tighter uppercase italic font-serif">Album de figurinhas</h1>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-4 text-xs font-mono uppercase tracking-widest opacity-70">
            <div className="flex flex-col items-end">
              <span>Colecionadas</span>
              <span className="text-amber-400 font-bold">{collection.filter(c => c.is_stuck).length} / {stickers.length}</span>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="flex flex-col items-end">
              <span>Repetidas</span>
              <span className="text-emerald-400 font-bold">{collection.reduce((acc, curr) => acc + (curr.quantity > 1 ? curr.quantity - 1 : 0), 0)}</span>
            </div>
          </div>
          <button 
            onClick={() => setShowSettings(true)}
            className="opacity-50 hover:opacity-100 cursor-pointer transition-opacity p-1"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-24">
        {activeTab === 'album' && renderAlbum()}
        {activeTab === 'inventory' && renderInventory()}
        {activeTab === 'market' && (
          <div className="max-w-5xl mx-auto p-8">
            <div className="text-center mb-12">
              <Repeat size={48} className="mx-auto mb-4 text-indigo-500" />
              <h2 className="text-3xl font-serif italic mb-2">Mercado de Trocas</h2>
              <p className="opacity-60 max-w-md mx-auto">
                Aqui você encontra figurinhas que outros colecionadores disponibilizaram. 
                Pegue o que falta no seu álbum!
              </p>
            </div>

            {swapMarket.length === 0 ? (
              <div className="bg-white/50 backdrop-blur p-12 rounded-3xl border-2 border-dashed border-black/10 text-center">
                <p className="opacity-40 font-serif italic">Nenhuma figurinha disponível para troca no momento...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {swapMarket.map(swap => (
                  <div key={swap.id} className="bg-white p-4 rounded-2xl shadow-sm border border-black/5 flex items-center gap-4 group hover:shadow-md transition-all">
                    <div className="w-20 h-28 flex-shrink-0 rounded-lg overflow-hidden shadow-inner bg-gray-50">
                      <img src={swap.image_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="flex-grow min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-bold text-sm truncate uppercase">{swap.name}</p>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-tighter ${
                          swap.rarity === 'lendária' ? 'bg-amber-100 text-amber-600' : 
                          swap.rarity === 'rara' ? 'bg-indigo-100 text-indigo-600' : 
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {swap.rarity}
                        </span>
                      </div>
                      <p className="text-[10px] opacity-50 uppercase font-bold tracking-wider mt-0.5">{swap.category}</p>
                      <p className="text-[10px] mt-2 opacity-40 italic">Dono: {swap.user_id}</p>
                      
                      {swap.user_id !== currentUser ? (
                        <button 
                          onClick={() => claimSwap(swap.id)}
                          className="mt-3 w-full bg-indigo-600 text-white py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                          Pegar Figurinha
                        </button>
                      ) : (
                        <div className="mt-3 w-full bg-gray-100 text-gray-400 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest text-center">
                          Sua figurinha
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'store' && (
          <div className="max-w-5xl mx-auto p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center text-center border-2 border-emerald-500/20">
                <div className="w-32 h-48 bg-emerald-500 rounded-xl shadow-2xl mb-6 flex items-center justify-center text-white relative overflow-hidden">
                  <Package size={64} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                </div>
                <h3 className="text-2xl font-serif italic mb-2">Pacote de Figurinhas</h3>
                <p className="text-sm opacity-60 mb-6">Contém 5 figurinhas aleatórias. Informe seu código de acesso abaixo.</p>
                
                <div className="w-full mb-2">
                  <div className="relative">
                    <Key className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={18} />
                    <input 
                      type="text" 
                      placeholder="INSIRA SEU CÓDIGO" 
                      value={packCode}
                      onChange={(e) => {
                        setPackCode(e.target.value.toUpperCase());
                        setStoreError(null);
                      }}
                      className="w-full bg-black/5 border-2 border-transparent focus:border-emerald-500 outline-none rounded-2xl py-4 pl-12 pr-4 font-mono font-bold tracking-widest transition-all"
                    />
                  </div>
                </div>

                {storeError && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold uppercase tracking-widest"
                  >
                    {storeError}
                  </motion.div>
                )}

                <button 
                  onClick={openPack}
                  disabled={!packCode.trim()}
                  className={`w-full py-4 rounded-2xl font-bold uppercase tracking-widest transition-all shadow-lg ${
                    packCode.trim() 
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/20' 
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Abrir Agora
                </button>
              </div>
              
              <div className="bg-white p-8 rounded-3xl shadow-xl flex flex-col items-center text-center opacity-50 grayscale">
                <div className="w-32 h-48 bg-amber-400 rounded-xl shadow-2xl mb-6 flex items-center justify-center text-black relative overflow-hidden">
                  <Store size={64} />
                </div>
                <h3 className="text-2xl font-serif italic mb-2">Pacote Premium</h3>
                <p className="text-sm opacity-60 mb-6">Maior chance de figurinhas raras e lendárias.</p>
                <button className="w-full bg-black text-white py-4 rounded-2xl font-bold uppercase tracking-widest cursor-not-allowed">
                  Em breve
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'admin' && isAdmin && (
          <div className="max-w-5xl mx-auto p-8">
            <div className="flex items-center justify-between mb-12">
              <div>
                <h2 className="text-3xl font-serif italic mb-2">Painel de Controle</h2>
                <p className="opacity-60">Gerencie os códigos de acesso aos pacotes.</p>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={generatePackCode}
                  className="bg-black text-white px-8 py-3 rounded-full font-bold uppercase tracking-widest hover:bg-gray-800 transition-all flex items-center gap-2"
                >
                  <Plus size={18} />
                  Gerar Novo Código
                </button>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-bottom border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest opacity-40">Código</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest opacity-40">Status</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest opacity-40">Criado em</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest opacity-40">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {adminCodes.map(code => (
                    <tr key={code.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-lg">{code.code}</td>
                      <td className="px-6 py-4">
                        {code.is_used ? (
                          <span className="bg-red-100 text-red-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase">Utilizado</span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase">Disponível</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs opacity-50">
                        {new Date(code.created_at).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 flex items-center gap-3">
                        {!code.is_used ? (
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(code.code);
                              alert("Código copiado!");
                            }}
                            className="text-indigo-600 hover:text-indigo-800 transition-colors"
                            title="Copiar código"
                          >
                            <Copy size={18} />
                          </button>
                        ) : (
                          <button 
                            onClick={() => reactivateCode(code.id)}
                            className="text-emerald-600 hover:text-emerald-800 transition-colors"
                            title="Reativar código"
                          >
                            <RefreshCw size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {adminCodes.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center opacity-40 italic">
                        Nenhum código gerado ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#141414] text-[#E4E3E0] border-t border-white/10 px-4 py-2 z-50">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <NavButton 
            active={activeTab === 'album'} 
            onClick={() => setActiveTab('album')} 
            icon={<Book size={20} />} 
            label="Álbum" 
          />
          <NavButton 
            active={activeTab === 'inventory'} 
            onClick={() => setActiveTab('inventory')} 
            icon={<LayoutGrid size={20} />} 
            label="Minhas Figurinhas" 
          />
          <div className="relative -top-6">
            <button 
              onClick={() => setActiveTab('store')}
              className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 ${activeTab === 'store' ? 'bg-emerald-500 text-white scale-110' : 'bg-amber-400 text-black'}`}
            >
              <Package size={28} />
            </button>
          </div>
          <NavButton 
            active={activeTab === 'market'} 
            onClick={() => setActiveTab('market')} 
            icon={<Repeat size={20} />} 
            label="Trocas" 
          />
          {isAdmin && (
            <NavButton 
              active={activeTab === 'admin'} 
              onClick={() => setActiveTab('admin')} 
              icon={<ShieldCheck size={20} />} 
              label="Admin" 
            />
          )}
          <NavButton 
            active={false} 
            href={`${window.location.origin}${window.location.pathname}?print=true&user=${currentUser}`}
            target="_blank"
            icon={<Printer size={20} />} 
            label="Imprimir" 
          />
        </div>
      </nav>

      {/* Pack Opening Overlay */}
      <AnimatePresence>
        {isOpeningPack && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-8"
          >
            {openedPack.length === 0 ? (
              <motion.div 
                animate={{ rotate: [0, -5, 5, -5, 5, 0], scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="w-48 h-72 bg-emerald-500 rounded-2xl shadow-2xl flex items-center justify-center text-white"
              >
                <Package size={80} />
              </motion.div>
            ) : (
              <div className="flex flex-col items-center gap-12 w-full max-w-4xl">
                <div className="flex flex-wrap justify-center gap-6">
                  {openedPack.map((sticker, i) => (
                    <motion.div
                      key={i}
                      initial={{ y: 100, opacity: 0, rotateY: 180 }}
                      animate={{ y: 0, opacity: 1, rotateY: 0 }}
                      transition={{ delay: i * 0.2, type: 'spring' }}
                      className="w-32 md:w-44 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl border-4 border-white/20"
                    >
                      <img src={sticker.image_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <div className={`absolute bottom-0 left-0 right-0 p-2 text-[10px] font-bold uppercase text-center ${sticker.rarity === 'lendária' ? 'bg-amber-400 text-black' : (sticker.rarity === 'rara' ? 'bg-indigo-500 text-white' : 'bg-black/50 text-white')}`}>
                        {sticker.name}
                      </div>
                    </motion.div>
                  ))}
                </div>
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.5 }}
                  onClick={() => {
                    setIsOpeningPack(false);
                    setOpenedPack([]);
                    setActiveTab('album');
                  }}
                  className="bg-white text-black px-12 py-4 rounded-full font-bold uppercase tracking-widest hover:bg-emerald-400 transition-colors"
                >
                  Continuar
                </motion.button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Selector Modal */}
      <AnimatePresence>
        {showPageSelector && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowPageSelector(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-serif italic uppercase tracking-tight">Selecionar Página</h3>
                <button onClick={() => setShowPageSelector(false)} className="p-2 hover:bg-black/5 rounded-full">
                  <X />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {categories.map((cat, i) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setCurrentPage(i);
                      setShowPageSelector(false);
                    }}
                    className={`p-4 rounded-xl border-2 transition-all text-sm font-bold uppercase tracking-widest ${currentPage === i ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-black/5 hover:border-black/20'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowSettings(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-serif italic uppercase tracking-tight">Configurações</h3>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-black/5 rounded-full">
                  <X />
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="p-4 bg-black/5 rounded-2xl">
                  <p className="text-xs uppercase tracking-widest opacity-50 mb-1">Usuário Atual</p>
                  <p className="font-bold text-lg">{currentUser}</p>
                </div>
                
                <button 
                  onClick={handleLogout}
                  className="w-full bg-red-50 text-red-600 py-4 rounded-2xl font-bold uppercase tracking-widest hover:bg-red-100 transition-all border-2 border-red-100"
                >
                  Sair do Álbum
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavButton({ active, onClick, icon, label, href, target }: { active: boolean, onClick?: () => void, icon: React.ReactNode, label: string, href?: string, target?: string }) {
  const className = `flex flex-col items-center gap-1 transition-all duration-300 ${active ? 'text-emerald-400 scale-110' : 'opacity-50 hover:opacity-100'}`;
  
  if (href) {
    return (
      <a href={href} target={target} className={className}>
        {icon}
        <span className="text-[10px] uppercase font-bold tracking-tighter">{label}</span>
      </a>
    );
  }

  return (
    <button 
      onClick={onClick}
      className={className}
    >
      {icon}
      <span className="text-[10px] uppercase font-bold tracking-tighter">{label}</span>
    </button>
  );
}
