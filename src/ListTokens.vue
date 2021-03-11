<template>
  <html>
    <div style="margin-top: 50px">
      List Tokens
      <div v-if="tokenListByUrls">
        <div v-for="url in Object.keys(tokenListByUrls)" :key="url">
          <div style="display: flex; align-items: center; justify-content: center">
            <h1>{{ url }}</h1>
            <img style="width: 50px; height: 50px; margin-left: 10px" :src="tokenListByUrls[url].logoURI" />
          </div>
          <ul>
            <li v-for="(token, index) in tokenListByUrls[url].tokens" :key="index">
              <strong style="margin-right: 20px">
                {{ token.symbol }} - {{ token.decimals }} - {{ token.name }}
              </strong>
              <img v-if="token.logoURI" :src="token.logoURI" style="width: 50px; height: 50px;" />
            </li>
          </ul>
        </div>
      </div>
    </div>
  </html>
</template>
<script>
  import Web3 from 'web3';
  import { Contract, ethers } from 'ethers';
  import { namehash } from 'ethers/lib/utils'
  import { ChainId } from '@uniswap/sdk';

  const COMPOUND_LIST = 'https://raw.githubusercontent.com/compound-finance/token-list/master/compound.tokenlist.json'
  const UMA_LIST = 'https://umaproject.org/uma.tokenlist.json'
  const AAVE_LIST = 'tokenlist.aave.eth'
  const SYNTHETIX_LIST = 'synths.snx.eth'
  const WRAPPED_LIST = 'wrapped.tokensoft.eth'
  const SET_LIST = 'https://raw.githubusercontent.com/SetProtocol/uniswap-tokenlist/main/set.tokenlist.json'
  const OPYN_LIST = 'https://raw.githubusercontent.com/opynfinance/opyn-tokenlist/master/opyn-v1.tokenlist.json'
  const ROLL_LIST = 'https://app.tryroll.com/tokens.json'
  const COINGECKO_LIST = 'https://tokens.coingecko.com/uniswap/all.json'
  const CMC_ALL_LIST = 'defi.cmc.eth'
  const CMC_STABLECOIN = 'stablecoin.cmc.eth'
  const KLEROS_LIST = 't2crtokens.eth'
  const GEMINI_LIST = 'https://www.gemini.com/uniswap/manifest.json'
  const BA_LIST = 'https://raw.githubusercontent.com/The-Blockchain-Association/sec-notice-list/master/ba-sec-list.json'

  export const UNSUPPORTED_LIST_URLS = [BA_LIST]

  // lower index == higher priority for token import
  export const DEFAULT_LIST_OF_LISTS = [
    COMPOUND_LIST,
    GEMINI_LIST,
    ROLL_LIST,
    SET_LIST
  ]

  // default lists to be 'active' aka searched across
  export const DEFAULT_ACTIVE_LIST_URLS = [GEMINI_LIST]

  const REGISTRAR_ABI = [
    {
      constant: true,
      inputs: [
        {
          name: 'node',
          type: 'bytes32'
        }
      ],
      name: 'resolver',
      outputs: [
        {
          name: 'resolverAddress',
          type: 'address'
        }
      ],
      payable: false,
      stateMutability: 'view',
      type: 'function'
    }
  ]
  const REGISTRAR_ADDRESS = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'

  const RESOLVER_ABI = [
    {
      constant: true,
      inputs: [
        {
          internalType: 'bytes32',
          name: 'node',
          type: 'bytes32'
        }
      ],
      name: 'contenthash',
      outputs: [
        {
          internalType: 'bytes',
          name: '',
          type: 'bytes'
        }
      ],
      payable: false,
      stateMutability: 'view',
      type: 'function'
    }
  ]

  export default {
    name: 'ListTokens',
    data: function () {
      return {
        tokenListByUrls: null ,
      }
    },
    mounted: async function() {
      const contentHash = await this.ensResolver('defi.cmc.eth');

      const tokenListByUrls = {};

      const tokenListsPromise = DEFAULT_LIST_OF_LISTS.map(url => fetch(url).then(response => response.json()));

      const tokenLists = await Promise.all(tokenListsPromise);

      tokenLists.map(tokenList => {
        const { name, tokens, logoURI } = tokenList;
        tokenListByUrls[name] = {
          tokens: tokens.filter(token => token.chainId === 1),
          logoURI
        }
      });

console.log(tokenListByUrls)
      this.tokenListByUrls = tokenListByUrls;
    },
    methods: {
      contenthashToUri(contenthash) {
        const UTF_8_DECODER = new TextDecoder()
        const buff = this.hexToUint8Array(contenthash)
        const codec = getCodec(buff) // the typing is wrong for @types/multicodec
        switch (codec) {
          case 'ipfs-ns': {
            const data = rmPrefix(buff)
            const cid = new CID(data)
            return `ipfs://${toB58String(cid.multihash)}`
          }
          case 'ipns-ns': {
            const data = rmPrefix(buff)
            const cid = new CID(data)
            const multihash = decode(cid.multihash)
            if (multihash.name === 'identity') {
              return `ipns://${UTF_8_DECODER.decode(multihash.digest).trim()}`
            } else {
              return `ipns://${toB58String(cid.multihash)}`
            }
          }
          default:
            throw new Error(`Unrecognized codec: ${codec}`)
        }
      },
      hexToUint8Array(hex) {
        hex = hex.startsWith('0x') ? hex.substr(2) : hex
        if (hex.length % 2 !== 0) throw new Error('hex must have length that is multiple of 2')
        const arr = new Uint8Array(hex.length / 2)
        for (let i = 0; i < arr.length; i++) {
          arr[i] = parseInt(hex.substr(i * 2, 2), 16)
        }
        return arr
      },
      ensResolver(esnName) {
        const provider = new ethers.providers.InfuraProvider('mainnet', 'd0151169c69948a884ef91d59c96c1d9');
        return this.resolveENSContentHash(esnName, provider);
      },

      resolverContract(resolverAddress, provider) {
        return new Contract(resolverAddress, RESOLVER_ABI, provider)
      },

      async resolveENSContentHash(esnName, provider) {
        const ensRegistrarContract = new Contract(REGISTRAR_ADDRESS, REGISTRAR_ABI, provider)
        const hash = namehash(esnName);
        const resolverAddress = await ensRegistrarContract.resolver(hash);
        return this.resolverContract(resolverAddress, provider).contenthash(hash);
      }
    }
  }
</script>

<style scoped>
  ul {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    padding: 0;
  }

  li {
    list-style-type: none;
    display: flex;
    align-items: center;
    margin-right: 20px;
    margin-top: 20px;
    width: 300px;
    justify-content: flex-end;
  }

</style>
