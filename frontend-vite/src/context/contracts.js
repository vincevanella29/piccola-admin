// Contexto de contratos: carga dinámica de todos los ABI desde src/contracts (como en el backend)
// Permite importar y usar cualquier ABI por nombre, igual que load_contract_abi en el backend

// NOTA: Solo funciona si usas Vite/Webpack o similar que soporte import.meta.glob

const abis = {};

import { ethers } from 'ethers';

// Carga todos los .json de la carpeta contracts (y subcarpetas) - ANTIGUOS
const Modules = import.meta.glob('../contracts/**/*.json', { eager: true });



export const CONTRACT_ADDRESSES = {
  VanellixLaunchpad: '0x8e27e95De4C2e7893B54C23DCe7D60983bE8896c',
  VanellixDAOController: '0x74C81546b7d355097be5a2A2ea44AAd0b5774bAF',
  WrappedToken: '0xc1b29e467a4FC7B328EC075B2eFC21Dcc56d5662',
  WrappedUtilityToken: '0x39b2829EaE4FaE3a66EB74506f9613441e89a30C',
  VanellixTokenFactory: '0xD46b1D42F1717aECF2Db16942e5f3f01743cDF4A',
  VanellixCompanyMultiToken: '0x67Fa14D2e04404E1f26837a31b15203db1D65ACf',
  CompanyStaking: '0xe37f33956f53922A22432A98501923C8E3425257',
  SimpleWalletMinting: '0x691ec7251177a0aE1E5012BAEB6070288c426F43',
  VanellixStakingMultiToken: '0xfcDA3d8e8F61Fc9b580452b52a4c4713472F514f',
  VanellixTokenSale: '0x118dD9b5eAEa261CC46238E089a139e869009ECD',
  VanellixCompanyMultiTokenV2: '0xc121D875AC6D9bcff3C9dC605aDed7735b3b1dCe',
  UniswapV2Factory: '0x131e7D9718A25BffC357d533298f96e8F22a0828',
  UniswapV2Router02: '0xf2D38F3d43B5BEa24a4137010D076010D8925007',
  GlobalMeritocracy: '0x9e01B392d7E5EEa64b704Eda0C4549543B77Bd54',
  VanellixLaunchpadV2: '0x822865B92C79456Ac09271158Ce7Ef55D346c5B7',
  VanellixCompanyMultiTokenV2: '0xabA4288d2056fE1D505f1785875E0691e6828429',
  WMATICMock: '0xb3973eff4c781777e6799A6b8Dc81c016d54AA8F',
  USDC: '0x655D966EbC02FF37Bf19c8C0A15F30E108C87960',
  VanellixRedemption: '0xCD9f5cF1Dc080E009684E0783a52aD7C053aD60b',
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
