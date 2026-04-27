/**
 * Catálogo de assets crypto soportados para depositar y sus redes
 * disponibles. Cada asset puede tener múltiples redes (USDT en TRC20,
 * ERC20, Polygon, etc.) — el usuario debe elegir la que coincida con
 * la red desde la que envía o pierde los fondos.
 *
 * Mock — en producción esta data vendría del backend y la dirección
 * se generaría por usuario × asset × red.
 */

export interface CryptoNetwork {
  id: string;
  /** Nombre largo de la red para el header (ej. "Tron", "Ethereum"). */
  label: string;
  /** Etiqueta corta del protocolo (TRC20, ERC20, BEP20, etc.). */
  protocol: string;
  /** Dirección de depósito del usuario en esta red. */
  address: string;
  /** Tiempo aproximado para que el depósito se acredite. */
  eta: string;
  /** Comisión típica que cobra la red (display only). */
  fee: string;
  /** Monto mínimo para que el depósito procese. */
  minDeposit: string;
  /** Confirmaciones necesarias antes de acreditar. */
  confirmations: number;
}

export interface CryptoAsset {
  ticker: string;
  name: string;
  /** Color de fondo del ícono (brand color de la moneda). */
  bg: string;
  /** Color del texto del ícono. */
  fg: string;
  /** Texto a mostrar dentro del ícono — default: primeros 4 chars del ticker. */
  iconText?: string;
  networks: CryptoNetwork[];
}

export const cryptoDepositAssets: CryptoAsset[] = [
  {
    ticker: "USDT",
    name: "Tether",
    bg: "#26A17B",
    fg: "#FFFFFF",
    iconText: "₮",
    networks: [
      {
        id: "usdt-trc20",
        label: "Tron",
        protocol: "TRC20",
        address: "TXp9N8mE3kP6sZQq7rV2WfJ5HdYn4Lc1aB",
        eta: "~1 min",
        fee: "≈ 1 USDT",
        minDeposit: "1 USDT",
        confirmations: 19,
      },
      {
        id: "usdt-erc20",
        label: "Ethereum",
        protocol: "ERC20",
        address: "0x4f5A2cBd7e91FdA38b3C0a9e21Db88E45fC7aB12",
        eta: "~3 min",
        fee: "≈ 3 USDT",
        minDeposit: "1 USDT",
        confirmations: 12,
      },
      {
        id: "usdt-polygon",
        label: "Polygon",
        protocol: "MATIC",
        address: "0x7c2E9aB4F3D8b51eA0c92Df45a78Bd1cE3F09a98",
        eta: "~30 seg",
        fee: "< 0,1 USDT",
        minDeposit: "1 USDT",
        confirmations: 128,
      },
      {
        id: "usdt-sol",
        label: "Solana",
        protocol: "SPL",
        address: "5qHe8kP3nL9XwT2YzQrV4Bf7mAcRdGpJuN6sWvHt2Wn",
        eta: "~10 seg",
        fee: "< 0,01 USDT",
        minDeposit: "0,1 USDT",
        confirmations: 1,
      },
      {
        id: "usdt-bsc",
        label: "BNB Chain",
        protocol: "BEP20",
        address: "0x9aF3eD12bC8a4D75e6F1B2c9D03a8E47fG5hI28",
        eta: "~30 seg",
        fee: "< 0,3 USDT",
        minDeposit: "1 USDT",
        confirmations: 15,
      },
    ],
  },
  {
    ticker: "USDC",
    name: "USD Coin",
    bg: "#2775CA",
    fg: "#FFFFFF",
    networks: [
      {
        id: "usdc-erc20",
        label: "Ethereum",
        protocol: "ERC20",
        address: "0xC1A8b5D2eF93aD47bC60d8E12Ff89A36cE5dB719",
        eta: "~3 min",
        fee: "≈ 3 USDC",
        minDeposit: "1 USDC",
        confirmations: 12,
      },
      {
        id: "usdc-polygon",
        label: "Polygon",
        protocol: "MATIC",
        address: "0x4dB58aE7F3c2D89bA01c5eF67Bd43A82cD9eF310",
        eta: "~30 seg",
        fee: "< 0,1 USDC",
        minDeposit: "1 USDC",
        confirmations: 128,
      },
      {
        id: "usdc-sol",
        label: "Solana",
        protocol: "SPL",
        address: "8tWcQ3rN6nL1XzT4YbHrV9Bf2mAcRdGpJuN8sKvJk5Pq",
        eta: "~10 seg",
        fee: "< 0,01 USDC",
        minDeposit: "0,1 USDC",
        confirmations: 1,
      },
      {
        id: "usdc-base",
        label: "Base",
        protocol: "Base",
        address: "0x6E2cF9b3A5d8Cb47E0a91Df85b13Cd67aE8fG924",
        eta: "~15 seg",
        fee: "< 0,05 USDC",
        minDeposit: "1 USDC",
        confirmations: 1,
      },
    ],
  },
  {
    ticker: "BTC",
    name: "Bitcoin",
    bg: "#F7931A",
    fg: "#FFFFFF",
    networks: [
      {
        id: "btc-mainnet",
        label: "Bitcoin",
        protocol: "BTC",
        address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
        eta: "~10 min",
        fee: "≈ 0,0002 BTC",
        minDeposit: "0,0001 BTC",
        confirmations: 2,
      },
      {
        id: "btc-lightning",
        label: "Lightning Network",
        protocol: "LN",
        address: "lnbc1pj9q3hgpp5jzmsc7v...mock_invoice",
        eta: "instant",
        fee: "< 0,00001 BTC",
        minDeposit: "0,00001 BTC",
        confirmations: 0,
      },
    ],
  },
  {
    ticker: "ETH",
    name: "Ethereum",
    bg: "#627EEA",
    fg: "#FFFFFF",
    networks: [
      {
        id: "eth-mainnet",
        label: "Ethereum",
        protocol: "ERC20",
        address: "0xA1b2C3d4E5f6071829abCdEf1234567890fEdCbA",
        eta: "~3 min",
        fee: "≈ 0,002 ETH",
        minDeposit: "0,001 ETH",
        confirmations: 12,
      },
      {
        id: "eth-arbitrum",
        label: "Arbitrum",
        protocol: "Arbitrum One",
        address: "0xB7c4D9e2F1aE38bC10d6A4f95aE2c3D87bF0aE16",
        eta: "~10 seg",
        fee: "< 0,0001 ETH",
        minDeposit: "0,001 ETH",
        confirmations: 1,
      },
      {
        id: "eth-base",
        label: "Base",
        protocol: "Base",
        address: "0xD8e5F6a7B0c1D4eA92c5B7f3aD61bE8cF2dA904E",
        eta: "~15 seg",
        fee: "< 0,0001 ETH",
        minDeposit: "0,001 ETH",
        confirmations: 1,
      },
    ],
  },
  {
    ticker: "SOL",
    name: "Solana",
    bg: "#14F195",
    fg: "#0E0F0C",
    networks: [
      {
        id: "sol-mainnet",
        label: "Solana",
        protocol: "SOL",
        address: "9xQpL3kN2mZw6YrV4Bf7mAcRdGpJuN8sKvJk5PqHt2W",
        eta: "~10 seg",
        fee: "< 0,001 SOL",
        minDeposit: "0,01 SOL",
        confirmations: 1,
      },
    ],
  },
  {
    ticker: "BNB",
    name: "BNB",
    bg: "#F0B90B",
    fg: "#0E0F0C",
    networks: [
      {
        id: "bnb-bsc",
        label: "BNB Chain",
        protocol: "BEP20",
        address: "0x3aE9fC4b8d2F75C19a6B0eF3Cd47bA82eF5gH126",
        eta: "~30 seg",
        fee: "< 0,001 BNB",
        minDeposit: "0,01 BNB",
        confirmations: 15,
      },
    ],
  },
  {
    ticker: "XRP",
    name: "XRP",
    bg: "#23292F",
    fg: "#FFFFFF",
    networks: [
      {
        id: "xrp-mainnet",
        label: "XRP Ledger",
        protocol: "XRP",
        address: "rPdvC6ccq8hCdPKSPJkPmyZ4Mi1oG2FFkT",
        eta: "~5 seg",
        fee: "< 0,01 XRP",
        minDeposit: "1 XRP",
        confirmations: 1,
      },
    ],
  },
  {
    ticker: "ADA",
    name: "Cardano",
    bg: "#0033AD",
    fg: "#FFFFFF",
    networks: [
      {
        id: "ada-mainnet",
        label: "Cardano",
        protocol: "ADA",
        address:
          "addr1qxk2c8s7vmxz9xj7z6w0p9rfw3dn0vuxqwqy7vzfy7zkqjg5p9d",
        eta: "~30 seg",
        fee: "< 0,2 ADA",
        minDeposit: "1 ADA",
        confirmations: 5,
      },
    ],
  },
];
