// Contexto de contratos: carga dinámica de todos los ABI desde src/contracts (como en el backend)
// Permite importar y usar cualquier ABI por nombre, igual que load_contract_abi en el backend

// NOTA: Solo funciona si usas Vite/Webpack o similar que soporte import.meta.glob

const abis = {};

import { ethers } from 'ethers';

// Carga todos los .json de la carpeta contracts (y subcarpetas) - ANTIGUOS
const Modules = import.meta.glob('../contracts/**/*.json', { eager: true });

export const CONTRACT_ADDRESSES = {
  VanellixLaunchpad: '0xECe6da1C29895BFaC35A97c9f6924d8377703A78',
  VanellixDAOController: '0x10DeEab22F15C15e5e6F298008eE85093b9F9dE5',
  WrappedToken: '0xf631e220bb388Da70ED44244Abf2e3d760350C21',
  WrappedUtilityToken: '0x7ed2aC904e8aBcb216740C225c20c41f9AFAe6C4',
  VanellixTokenFactory: '0x826a744E592c16D26550b68E75b239A6Fa3F62Bd',
  VanellixCompanyMultiToken: '0x5A21820cEd7eBD23bac63AD955d4F185bFF77de9',
  CompanyStaking: '0x138c6CE06c084327390B3354Bf2D2Dc961Cf7c86',
  SimpleWalletMinting: '0x38fF4995796b99A46A7096Bdfd0522Aa8e74CB5b',
  VanellixStakingMultiToken: '0x7dBC84ba916A0132EE8C0526cF8F6B73b1FD5C0d',
  VanellixTokenSale: '0xaaDB2157Eaf18F70fC92d575A681863E3827D9E9',
  VanellixCompanyMultiTokenV2: '0x2F236bE6Add0dbc54C01F0649eA4FC26864Be1F4',
  UniswapV2Factory: '0x3E6b9f8C3b06dE9591348017FdF0860ABd49Bc20',
  UniswapV2Router02: '0x2741F2b3aa5C436b1860Ca71beC9779ac762Fd01',
  GlobalMeritocracy: '0xe75ec4b2d3Cb5D92a0bb3d4Eab545B5BF4e5AaaC',
  VanellixLaunchpadV2: '0x2A9ca77a0Ca020979C0513e09F21a471e625d470',
  WMATICMock: '0x06036E45348bcDe39e42aaf979fd8b10833d3847',
  USDC: '0x216978C50bbeE7b655f824a2CE0203Fc552F73a3',
  VanellixRedemption: '0xFd2Ef2437C434B7Bf94598398B3683A77AA1A6B5',
};

export const CONTRACT_ABIS = {};

// Helper function (no exportada) para poblar las colecciones de ABIs
function _populateAbis(modulesObject, importPathPrefix, targetAbiCollection) {
  for (const path in modulesObject) {
    // importPathPrefix será '../contracts/' o '../contracts-new/'
    const relPath = path.replace(importPathPrefix, '').replace(/\.json$/, '');
    const match = path.match(/([\w\d_-]+)\.json$/);
    if (!match) continue;
    const contractName = match[1];
    const abi = modulesObject[path].abi || modulesObject[path].default?.abi || modulesObject[path];
    targetAbiCollection[relPath] = abi;
    // Si no existe clave simple (solo nombre del contrato), agrégala también
    if (!targetAbiCollection[contractName]) {
      targetAbiCollection[contractName] = abi;
    }
  }
}

_populateAbis(Modules, '../contracts/', CONTRACT_ABIS);

// Inicialización de contratos (requiere provider/signer)
export function getContractInstance(contractName, providerOrSigner, customAddress) {
  const addressesToUse = CONTRACT_ADDRESSES;
  const abisToUse = CONTRACT_ABIS;

  const address = customAddress || addressesToUse[contractName];
  const abi = abisToUse[contractName];

  if (!address) throw new Error(`Dirección no encontrada para contrato: ${contractName}`);
  if (!abi) throw new Error(`ABI no encontrado para contrato: ${contractName}`);
  return new ethers.Contract(address, abi, providerOrSigner);
}

export function getContractAbi(contractName) {
  const abisToUse = CONTRACT_ABIS;
  if (!abisToUse[contractName]) throw new Error(`ABI no encontrado para contrato: ${contractName} (versión: ${version})`);
  return abisToUse[contractName];
}

// Ejemplo de uso:
// import { getContractAbi } from '../context/contracts';
// const abi = getContractAbi('VanellixLaunchpad');
