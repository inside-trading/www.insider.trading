// ================================================
// Insider Trading - Web 2.5 Authentication Module
// Supports: Social logins (Google, Apple, Email, Phone)
//           Wallet connections (MetaMask, Rainbow, Phantom, Coinbase, etc.)
//           Embedded wallets (custodial option)
// ================================================

// Auth State
const authState = {
    initialized: false,
    authenticated: false,
    user: null,
    walletAddress: null,
    walletType: null, // 'embedded', 'external', or null
    loginMethod: null, // 'google', 'apple', 'email', 'phone', 'wallet'
    embeddedWallet: null,
    externalWallet: null
};

// Configuration
const AUTH_CONFIG = {
    // App info for Privy/wallet connections
    appName: 'Insider Trading',
    appDescription: 'Predict the future. Earn rewards.',
    appUrl: window.location.origin,
    appIcon: window.location.origin + '/assets/favicon.svg',

    // Supported chains
    chains: [
        { id: 1, name: 'Ethereum', rpcUrl: 'https://eth.llamarpc.com' },
        { id: 11155111, name: 'Sepolia', rpcUrl: 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161' },
        { id: 8453, name: 'Base', rpcUrl: 'https://mainnet.base.org' },
        { id: 137, name: 'Polygon', rpcUrl: 'https://polygon-rpc.com' },
        { id: 42161, name: 'Arbitrum', rpcUrl: 'https://arb1.arbitrum.io/rpc' },
        { id: 10, name: 'Optimism', rpcUrl: 'https://mainnet.optimism.io' },
        { id: 56, name: 'BNB Chain', rpcUrl: 'https://bsc-dataseed.binance.org' }
    ],

    // Wallet icons
    walletIcons: {
        metamask: '/assets/wallets/metamask.svg',
        rainbow: '/assets/wallets/rainbow.svg',
        phantom: '/assets/wallets/phantom.svg',
        coinbase: '/assets/wallets/coinbase.svg',
        trust: '/assets/wallets/trust.svg',
        walletconnect: '/assets/wallets/walletconnect.svg',
        brave: '/assets/wallets/brave.svg',
        embedded: '/assets/wallets/embedded.svg'
    }
};

// Social login providers info
const SOCIAL_PROVIDERS = [
    {
        id: 'google',
        name: 'Continue with Google',
        icon: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>`,
        color: '#ffffff',
        bgColor: '#ffffff',
        textColor: '#1f1f1f'
    },
    {
        id: 'apple',
        name: 'Continue with Apple',
        icon: `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
        </svg>`,
        color: '#ffffff',
        bgColor: '#000000',
        textColor: '#ffffff'
    }
];

// Email/Phone login config
const CREDENTIAL_PROVIDERS = [
    {
        id: 'email',
        name: 'Email',
        placeholder: 'Enter your email',
        type: 'email',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="M22 6L12 13L2 6"/>
        </svg>`
    },
    {
        id: 'phone',
        name: 'Phone',
        placeholder: 'Enter your phone number',
        type: 'tel',
        icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="5" y="2" width="14" height="20" rx="2"/>
            <line x1="12" y1="18" x2="12" y2="18"/>
        </svg>`
    }
];

// External wallet providers
const WALLET_PROVIDERS = [
    { id: 'metamask', name: 'MetaMask', tag: 'Popular', detect: () => window.ethereum?.isMetaMask },
    { id: 'rainbow', name: 'Rainbow', tag: '', detect: () => window.ethereum?.isRainbow },
    { id: 'phantom', name: 'Phantom', tag: 'Multi-chain', detect: () => window.phantom?.ethereum },
    { id: 'coinbase', name: 'Coinbase Wallet', tag: '', detect: () => window.ethereum?.isCoinbaseWallet },
    { id: 'trust', name: 'Trust Wallet', tag: '', detect: () => window.ethereum?.isTrust },
    { id: 'walletconnect', name: 'WalletConnect', tag: 'Mobile', detect: () => true },
    { id: 'brave', name: 'Brave Wallet', tag: '', detect: () => window.ethereum?.isBraveWallet }
];

// ================================================
// Auth Modal UI
// ================================================

function createAuthModal() {
    // Check if modal already exists
    if (document.getElementById('authModal')) {
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'authModal';
    modal.className = 'modal auth-modal';

    modal.innerHTML = `
        <div class="modal-content auth-modal-content">
            <button class="modal-close" id="closeAuthModal">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
            </button>

            <div class="auth-modal-header">
                <h2 class="auth-modal-title">Welcome to Insider Trading</h2>
                <p class="auth-modal-subtitle">Sign in to start making predictions</p>
            </div>

            <!-- Auth Tabs -->
            <div class="auth-tabs">
                <button class="auth-tab active" data-tab="social">Quick Start</button>
                <button class="auth-tab" data-tab="wallet">Connect Wallet</button>
            </div>

            <!-- Social Login Section -->
            <div class="auth-section" id="socialAuthSection">
                <div class="social-login-buttons">
                    ${SOCIAL_PROVIDERS.map(provider => `
                        <button class="social-login-btn" data-provider="${provider.id}"
                                style="background: ${provider.bgColor}; color: ${provider.textColor}">
                            <span class="social-icon">${provider.icon}</span>
                            <span>${provider.name}</span>
                        </button>
                    `).join('')}
                </div>

                <div class="auth-divider">
                    <span>or</span>
                </div>

                <!-- Email/Phone Toggle -->
                <div class="credential-tabs">
                    ${CREDENTIAL_PROVIDERS.map((provider, i) => `
                        <button class="credential-tab ${i === 0 ? 'active' : ''}" data-credential="${provider.id}">
                            ${provider.icon}
                            <span>${provider.name}</span>
                        </button>
                    `).join('')}
                </div>

                <!-- Credential Input -->
                <div class="credential-input-container">
                    <input type="email" id="credentialInput" class="credential-input"
                           placeholder="Enter your email" autocomplete="email">
                    <button class="credential-submit-btn" id="credentialSubmitBtn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                    </button>
                </div>

                <!-- OTP Verification (hidden initially) -->
                <div class="otp-container" id="otpContainer" style="display: none;">
                    <p class="otp-message">Enter the code sent to <span id="otpDestination"></span></p>
                    <div class="otp-inputs">
                        <input type="text" maxlength="1" class="otp-input" data-index="0">
                        <input type="text" maxlength="1" class="otp-input" data-index="1">
                        <input type="text" maxlength="1" class="otp-input" data-index="2">
                        <input type="text" maxlength="1" class="otp-input" data-index="3">
                        <input type="text" maxlength="1" class="otp-input" data-index="4">
                        <input type="text" maxlength="1" class="otp-input" data-index="5">
                    </div>
                    <button class="resend-otp-btn" id="resendOtpBtn">Resend code</button>
                </div>

                <div class="auth-info-box">
                    <div class="info-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M12 16v-4M12 8h.01"/>
                        </svg>
                    </div>
                    <div class="info-content">
                        <strong>No wallet? No problem!</strong>
                        <p>We'll create a secure wallet for you automatically. Claim your rewards anytime.</p>
                    </div>
                </div>
            </div>

            <!-- Wallet Connect Section -->
            <div class="auth-section" id="walletAuthSection" style="display: none;">
                <div class="wallet-list auth-wallet-list">
                    ${WALLET_PROVIDERS.map(wallet => `
                        <div class="wallet-list-item auth-wallet-item" data-wallet="${wallet.id}">
                            <img src="${AUTH_CONFIG.walletIcons[wallet.id]}" alt="${wallet.name}"
                                 onerror="this.src='/assets/wallets/default.svg'">
                            <span class="wallet-list-item-name">${wallet.name}</span>
                            ${wallet.tag ? `<span class="wallet-list-item-tag">${wallet.tag}</span>` : ''}
                            ${wallet.detect() ? '<span class="wallet-detected">Detected</span>' : ''}
                        </div>
                    `).join('')}
                </div>

                <div class="auth-info-box wallet-info-box">
                    <div class="info-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                        </svg>
                    </div>
                    <div class="info-content">
                        <strong>Already have a wallet?</strong>
                        <p>Connect your existing wallet to manage your own keys and access all features.</p>
                    </div>
                </div>
            </div>

            <p class="auth-disclaimer">
                By continuing, you agree to our <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>
            </p>
        </div>
    `;

    document.body.appendChild(modal);
    setupAuthModalListeners();
}

function setupAuthModalListeners() {
    const modal = document.getElementById('authModal');
    if (!modal) return;

    // Close button
    document.getElementById('closeAuthModal')?.addEventListener('click', closeAuthModal);

    // Click outside to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeAuthModal();
    });

    // Tab switching
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabId = e.currentTarget.dataset.tab;
            switchAuthTab(tabId);
        });
    });

    // Social login buttons
    document.querySelectorAll('.social-login-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const provider = e.currentTarget.dataset.provider;
            handleSocialLogin(provider);
        });
    });

    // Credential tabs (email/phone)
    document.querySelectorAll('.credential-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const type = e.currentTarget.dataset.credential;
            switchCredentialTab(type);
        });
    });

    // Credential submit
    document.getElementById('credentialSubmitBtn')?.addEventListener('click', handleCredentialSubmit);
    document.getElementById('credentialInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleCredentialSubmit();
    });

    // OTP inputs
    document.querySelectorAll('.otp-input').forEach(input => {
        input.addEventListener('input', handleOtpInput);
        input.addEventListener('keydown', handleOtpKeydown);
    });

    // Resend OTP
    document.getElementById('resendOtpBtn')?.addEventListener('click', handleResendOtp);

    // Wallet selection
    document.querySelectorAll('.auth-wallet-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const walletId = e.currentTarget.dataset.wallet;
            handleWalletConnect(walletId);
        });
    });
}

function switchAuthTab(tabId) {
    // Update tab buttons
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabId);
    });

    // Show/hide sections
    document.getElementById('socialAuthSection').style.display = tabId === 'social' ? 'block' : 'none';
    document.getElementById('walletAuthSection').style.display = tabId === 'wallet' ? 'block' : 'none';
}

function switchCredentialTab(type) {
    // Update tab buttons
    document.querySelectorAll('.credential-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.credential === type);
    });

    // Update input
    const input = document.getElementById('credentialInput');
    const provider = CREDENTIAL_PROVIDERS.find(p => p.id === type);
    if (input && provider) {
        input.type = provider.type;
        input.placeholder = provider.placeholder;
        input.value = '';
        input.autocomplete = type;
    }

    // Hide OTP if visible
    document.getElementById('otpContainer').style.display = 'none';
    document.querySelector('.credential-input-container').style.display = 'flex';
}

// ================================================
// Social Login Handlers
// ================================================

async function handleSocialLogin(provider) {
    console.log(`Initiating ${provider} login...`);

    // Show loading state
    const btn = document.querySelector(`.social-login-btn[data-provider="${provider}"]`);
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<span class="loading-spinner"></span> Connecting...';
    btn.disabled = true;

    try {
        // In production, this would use Privy SDK
        // For demo, simulate OAuth flow
        await simulateSocialLogin(provider);

    } catch (error) {
        console.error(`${provider} login failed:`, error);
        showAuthError(`Failed to sign in with ${provider}. Please try again.`);
    } finally {
        btn.innerHTML = originalContent;
        btn.disabled = false;
    }
}

async function simulateSocialLogin(provider) {
    // Simulate OAuth delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Create mock user based on provider
    const mockUsers = {
        google: { email: 'user@gmail.com', name: 'Demo User', avatar: null },
        apple: { email: 'user@icloud.com', name: 'Demo User', avatar: null }
    };

    const user = mockUsers[provider] || mockUsers.google;

    // Create embedded wallet for social login users
    const embeddedWallet = generateMockWallet();

    // Update auth state
    authState.authenticated = true;
    authState.user = {
        id: 'user_' + Math.random().toString(36).substr(2, 9),
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        loginMethod: provider
    };
    authState.walletAddress = embeddedWallet.address;
    authState.walletType = 'embedded';
    authState.loginMethod = provider;
    authState.embeddedWallet = embeddedWallet;

    // Store in localStorage
    saveAuthState();

    // Update UI
    closeAuthModal();
    updateAuthUI();

    // Trigger callback
    if (typeof window.onAuthStateChange === 'function') {
        window.onAuthStateChange(authState);
    }
}

// ================================================
// Email/Phone Login Handlers
// ================================================

async function handleCredentialSubmit() {
    const input = document.getElementById('credentialInput');
    const value = input?.value?.trim();
    const activeTab = document.querySelector('.credential-tab.active');
    const type = activeTab?.dataset.credential || 'email';

    if (!value) {
        showAuthError(`Please enter your ${type}`);
        return;
    }

    // Validate input
    if (type === 'email' && !isValidEmail(value)) {
        showAuthError('Please enter a valid email address');
        return;
    }

    if (type === 'phone' && !isValidPhone(value)) {
        showAuthError('Please enter a valid phone number');
        return;
    }

    // Show loading
    const btn = document.getElementById('credentialSubmitBtn');
    btn.innerHTML = '<span class="loading-spinner small"></span>';
    btn.disabled = true;

    try {
        // In production, send OTP via Privy
        await sendOTP(type, value);

        // Show OTP input
        document.querySelector('.credential-input-container').style.display = 'none';
        document.getElementById('otpContainer').style.display = 'block';
        document.getElementById('otpDestination').textContent = value;

        // Focus first OTP input
        document.querySelector('.otp-input')?.focus();

    } catch (error) {
        console.error('Failed to send OTP:', error);
        showAuthError('Failed to send verification code. Please try again.');
    } finally {
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>`;
        btn.disabled = false;
    }
}

async function sendOTP(type, destination) {
    // Simulate OTP send
    console.log(`Sending OTP to ${type}: ${destination}`);
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Store for verification
    authState._pendingOtp = {
        type,
        destination,
        code: '123456', // In production, this would be handled server-side
        expiresAt: Date.now() + 5 * 60 * 1000
    };
}

function handleOtpInput(e) {
    const input = e.target;
    const index = parseInt(input.dataset.index);
    const value = input.value;

    if (value.length === 1) {
        // Move to next input
        const nextInput = document.querySelector(`.otp-input[data-index="${index + 1}"]`);
        if (nextInput) {
            nextInput.focus();
        } else {
            // All inputs filled, verify OTP
            verifyOtp();
        }
    }
}

function handleOtpKeydown(e) {
    const input = e.target;
    const index = parseInt(input.dataset.index);

    if (e.key === 'Backspace' && !input.value && index > 0) {
        const prevInput = document.querySelector(`.otp-input[data-index="${index - 1}"]`);
        if (prevInput) {
            prevInput.focus();
            prevInput.value = '';
        }
    }
}

async function verifyOtp() {
    const otpInputs = document.querySelectorAll('.otp-input');
    const otp = Array.from(otpInputs).map(input => input.value).join('');

    if (otp.length !== 6) return;

    console.log('Verifying OTP:', otp);

    // Show loading on OTP inputs
    otpInputs.forEach(input => input.disabled = true);

    try {
        // Simulate verification
        await new Promise(resolve => setTimeout(resolve, 1000));

        // In production, verify with Privy
        // For demo, accept any 6-digit code

        // Create user with embedded wallet
        const embeddedWallet = generateMockWallet();
        const pending = authState._pendingOtp;

        authState.authenticated = true;
        authState.user = {
            id: 'user_' + Math.random().toString(36).substr(2, 9),
            email: pending?.type === 'email' ? pending.destination : null,
            phone: pending?.type === 'phone' ? pending.destination : null,
            name: null,
            loginMethod: pending?.type
        };
        authState.walletAddress = embeddedWallet.address;
        authState.walletType = 'embedded';
        authState.loginMethod = pending?.type;
        authState.embeddedWallet = embeddedWallet;
        delete authState._pendingOtp;

        saveAuthState();
        closeAuthModal();
        updateAuthUI();

        if (typeof window.onAuthStateChange === 'function') {
            window.onAuthStateChange(authState);
        }

    } catch (error) {
        console.error('OTP verification failed:', error);
        showAuthError('Invalid verification code. Please try again.');
        otpInputs.forEach(input => {
            input.disabled = false;
            input.value = '';
        });
        otpInputs[0].focus();
    }
}

async function handleResendOtp() {
    const pending = authState._pendingOtp;
    if (!pending) return;

    const btn = document.getElementById('resendOtpBtn');
    btn.textContent = 'Sending...';
    btn.disabled = true;

    try {
        await sendOTP(pending.type, pending.destination);
        btn.textContent = 'Code sent!';
        setTimeout(() => {
            btn.textContent = 'Resend code';
            btn.disabled = false;
        }, 3000);
    } catch (error) {
        btn.textContent = 'Resend code';
        btn.disabled = false;
        showAuthError('Failed to resend code');
    }
}

// ================================================
// Wallet Connection Handlers
// ================================================

async function handleWalletConnect(walletId) {
    console.log(`Connecting wallet: ${walletId}`);

    const item = document.querySelector(`.auth-wallet-item[data-wallet="${walletId}"]`);
    if (item) {
        item.classList.add('connecting');
    }

    try {
        let address = null;

        if (walletId === 'walletconnect') {
            // WalletConnect requires separate handling
            address = await connectWalletConnect();
        } else if (walletId === 'phantom') {
            // Phantom has its own provider
            address = await connectPhantom();
        } else {
            // Standard EIP-1193 wallets (MetaMask, Rainbow, Coinbase, etc.)
            address = await connectEIP1193Wallet(walletId);
        }

        if (address) {
            authState.authenticated = true;
            authState.user = {
                id: 'wallet_' + address.toLowerCase(),
                email: null,
                name: null,
                loginMethod: 'wallet'
            };
            authState.walletAddress = address;
            authState.walletType = 'external';
            authState.loginMethod = 'wallet';
            authState.externalWallet = { id: walletId, address };

            saveAuthState();
            closeAuthModal();
            updateAuthUI();

            if (typeof window.onAuthStateChange === 'function') {
                window.onAuthStateChange(authState);
            }
        }

    } catch (error) {
        console.error(`Failed to connect ${walletId}:`, error);

        if (error.code === 4001) {
            // User rejected
            showAuthError('Connection cancelled');
        } else if (error.message?.includes('not installed')) {
            showAuthError(`${walletId} is not installed. Please install it first.`);
        } else {
            showAuthError(`Failed to connect ${walletId}. Please try again.`);
        }
    } finally {
        if (item) {
            item.classList.remove('connecting');
        }
    }
}

async function connectEIP1193Wallet(walletId) {
    let provider = window.ethereum;

    // Handle multiple wallet providers
    if (window.ethereum?.providers) {
        provider = window.ethereum.providers.find(p => {
            switch (walletId) {
                case 'metamask': return p.isMetaMask && !p.isBraveWallet;
                case 'coinbase': return p.isCoinbaseWallet;
                case 'rainbow': return p.isRainbow;
                case 'trust': return p.isTrust;
                case 'brave': return p.isBraveWallet;
                default: return p.isMetaMask;
            }
        }) || window.ethereum;
    }

    if (!provider) {
        throw new Error(`${walletId} not installed`);
    }

    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    return accounts[0];
}

async function connectPhantom() {
    const provider = window.phantom?.ethereum;

    if (!provider) {
        throw new Error('Phantom not installed');
    }

    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    return accounts[0];
}

async function connectWalletConnect() {
    // In production, use WalletConnect SDK
    // For demo, show message
    showAuthError('WalletConnect: Scan QR code with your mobile wallet (demo mode)');

    // Simulate connection
    await new Promise(resolve => setTimeout(resolve, 2000));
    return generateMockWallet().address;
}

// ================================================
// UI Update Functions
// ================================================

function updateAuthUI() {
    const connectBtns = document.querySelectorAll('.connect-wallet-btn, #connectWalletBtn');

    connectBtns.forEach(btn => {
        if (authState.authenticated) {
            const displayText = getDisplayIdentifier();
            btn.innerHTML = `
                <span class="connected-indicator"></span>
                <span class="user-display">${displayText}</span>
                <svg class="dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 9l6 6 6-6"/>
                </svg>
            `;
            btn.classList.add('connected');

            // Change click handler to show user menu
            btn.onclick = toggleUserMenu;
        } else {
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" class="wallet-icon">
                    <rect x="2" y="6" width="20" height="14" rx="2" stroke="currentColor" stroke-width="2"/>
                    <path d="M16 13.5C16 14.3284 15.3284 15 14.5 15C13.6716 15 13 14.3284 13 13.5C13 12.6716 13.6716 12 14.5 12C15.3284 12 16 12.6716 16 13.5Z" fill="currentColor"/>
                    <path d="M6 6V5C6 3.89543 6.89543 3 8 3H18C19.1046 3 20 3.89543 20 5V6" stroke="currentColor" stroke-width="2"/>
                </svg>
                Sign In
            `;
            btn.classList.remove('connected');
            btn.onclick = openAuthModal;
        }
    });

    // Update network badge visibility
    const networkBadge = document.getElementById('networkBadge');
    if (networkBadge) {
        networkBadge.style.display = authState.authenticated ? 'flex' : 'none';
    }
}

function getDisplayIdentifier() {
    if (authState.user?.email) {
        return authState.user.email.split('@')[0];
    }
    if (authState.user?.phone) {
        return '•••' + authState.user.phone.slice(-4);
    }
    if (authState.walletAddress) {
        return `${authState.walletAddress.slice(0, 6)}...${authState.walletAddress.slice(-4)}`;
    }
    return 'Connected';
}

function createUserMenu() {
    // Remove existing menu
    document.getElementById('userMenu')?.remove();

    const menu = document.createElement('div');
    menu.id = 'userMenu';
    menu.className = 'user-menu';

    menu.innerHTML = `
        <div class="user-menu-header">
            <div class="user-avatar">
                ${authState.user?.avatar ?
                    `<img src="${authState.user.avatar}" alt="Avatar">` :
                    `<span>${(authState.user?.email?.[0] || authState.walletAddress?.[2] || 'U').toUpperCase()}</span>`
                }
            </div>
            <div class="user-info">
                <div class="user-name">${authState.user?.name || getDisplayIdentifier()}</div>
                <div class="user-email">${authState.user?.email || authState.walletAddress || ''}</div>
            </div>
        </div>

        ${authState.walletType === 'embedded' ? `
            <div class="user-menu-section">
                <div class="menu-section-title">Your Wallet</div>
                <div class="wallet-address-display">
                    <span class="address">${authState.walletAddress?.slice(0, 10)}...${authState.walletAddress?.slice(-8)}</span>
                    <button class="copy-btn" onclick="copyWalletAddress()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2"/>
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                        </svg>
                    </button>
                </div>
                <p class="wallet-custody-note">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    Secured by Insider Trading. Export anytime.
                </p>
            </div>
        ` : `
            <div class="user-menu-section">
                <div class="menu-section-title">Connected Wallet</div>
                <div class="wallet-address-display">
                    <span class="address">${authState.walletAddress?.slice(0, 10)}...${authState.walletAddress?.slice(-8)}</span>
                    <button class="copy-btn" onclick="copyWalletAddress()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2"/>
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                        </svg>
                    </button>
                </div>
            </div>
        `}

        <div class="user-menu-actions">
            ${authState.walletType === 'embedded' ? `
                <button class="menu-action-btn" onclick="exportWallet()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Export Wallet
                </button>
            ` : ''}
            <button class="menu-action-btn" onclick="viewOnExplorer()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                View on Explorer
            </button>
            <button class="menu-action-btn logout" onclick="logout()">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Sign Out
            </button>
        </div>
    `;

    document.body.appendChild(menu);

    // Close on click outside
    setTimeout(() => {
        document.addEventListener('click', closeUserMenuOnClickOutside);
    }, 0);

    return menu;
}

function toggleUserMenu(e) {
    e.stopPropagation();

    const existingMenu = document.getElementById('userMenu');
    if (existingMenu) {
        existingMenu.remove();
        document.removeEventListener('click', closeUserMenuOnClickOutside);
    } else {
        const menu = createUserMenu();

        // Position menu below button
        const btn = e.currentTarget;
        const rect = btn.getBoundingClientRect();
        menu.style.top = `${rect.bottom + 8}px`;
        menu.style.right = `${window.innerWidth - rect.right}px`;
    }
}

function closeUserMenuOnClickOutside(e) {
    const menu = document.getElementById('userMenu');
    if (menu && !menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeUserMenuOnClickOutside);
    }
}

// ================================================
// Utility Functions
// ================================================

function generateMockWallet() {
    // Generate a random Ethereum address for demo
    const address = '0x' + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    return { address };
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
    return /^\+?[\d\s-()]{10,}$/.test(phone);
}

function showAuthError(message) {
    // Remove existing error
    document.querySelector('.auth-error')?.remove();

    const error = document.createElement('div');
    error.className = 'auth-error';
    error.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>${message}</span>
    `;

    const modalContent = document.querySelector('.auth-modal-content');
    if (modalContent) {
        modalContent.insertBefore(error, modalContent.querySelector('.auth-tabs'));
        setTimeout(() => error.remove(), 5000);
    }
}

function saveAuthState() {
    try {
        const stateToSave = {
            authenticated: authState.authenticated,
            user: authState.user,
            walletAddress: authState.walletAddress,
            walletType: authState.walletType,
            loginMethod: authState.loginMethod
        };
        localStorage.setItem('insider_auth', JSON.stringify(stateToSave));
    } catch (e) {
        console.error('Failed to save auth state:', e);
    }
}

function loadAuthState() {
    try {
        const saved = localStorage.getItem('insider_auth');
        if (saved) {
            const parsed = JSON.parse(saved);
            Object.assign(authState, parsed);
            return true;
        }
    } catch (e) {
        console.error('Failed to load auth state:', e);
    }
    return false;
}

// ================================================
// Public API
// ================================================

function openAuthModal() {
    createAuthModal();
    document.getElementById('authModal')?.classList.add('active');
}

function closeAuthModal() {
    document.getElementById('authModal')?.classList.remove('active');

    // Reset state
    document.getElementById('otpContainer').style.display = 'none';
    document.querySelector('.credential-input-container').style.display = 'flex';
    document.getElementById('credentialInput').value = '';
    document.querySelectorAll('.otp-input').forEach(input => input.value = '');
}

function logout() {
    authState.authenticated = false;
    authState.user = null;
    authState.walletAddress = null;
    authState.walletType = null;
    authState.loginMethod = null;
    authState.embeddedWallet = null;
    authState.externalWallet = null;

    localStorage.removeItem('insider_auth');

    document.getElementById('userMenu')?.remove();
    updateAuthUI();

    if (typeof window.onAuthStateChange === 'function') {
        window.onAuthStateChange(authState);
    }
}

function copyWalletAddress() {
    if (authState.walletAddress) {
        navigator.clipboard.writeText(authState.walletAddress);

        // Show feedback
        const copyBtn = document.querySelector('.copy-btn');
        if (copyBtn) {
            copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
            </svg>`;
            setTimeout(() => {
                copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2"/>
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>`;
            }, 2000);
        }
    }
}

function exportWallet() {
    // In production, this would show a secure export flow
    alert('Wallet export feature coming soon! Your private key will be encrypted and downloadable.');
}

function viewOnExplorer() {
    if (authState.walletAddress) {
        // Default to Ethereum mainnet explorer
        window.open(`https://etherscan.io/address/${authState.walletAddress}`, '_blank');
    }
}

function getAuthState() {
    return { ...authState };
}

function isAuthenticated() {
    return authState.authenticated;
}

function getWalletAddress() {
    return authState.walletAddress;
}

// ================================================
// Initialization
// ================================================

function initAuth() {
    if (authState.initialized) return;

    // Load saved state
    loadAuthState();

    // Update UI based on loaded state
    updateAuthUI();

    // Listen for wallet changes (external wallets)
    if (window.ethereum) {
        window.ethereum.on('accountsChanged', (accounts) => {
            if (authState.walletType === 'external') {
                if (accounts.length === 0) {
                    logout();
                } else {
                    authState.walletAddress = accounts[0];
                    saveAuthState();
                    updateAuthUI();
                }
            }
        });
    }

    authState.initialized = true;
    console.log('Auth module initialized');
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    initAuth();
}

// Export for global access
window.InsiderAuth = {
    openAuthModal,
    closeAuthModal,
    logout,
    getAuthState,
    isAuthenticated,
    getWalletAddress,
    copyWalletAddress,
    exportWallet,
    viewOnExplorer
};
