<template>
  <div id="app">
    <input type="radio" v-model="isMetamask" value="false">PrivateKey
    <input type="radio" v-model="isMetamask" value="true">Metamask
    <br>
    <br>
    <br>
    <button @click="getBalance()">
      Show Balance
    </button>
    <button @click="approve()">
      Approve
    </button>
    <button @click="swap()">
      Swap
    </button>
    <button @click="getPrice()">
      Get Price
    </button>
    <button @click="getMinimumReceived()">
      Get Minimum Received
    </button>
    <button @click="getPriceImpact()">
      Get Price Impact
    </button>
    <button @click="getFee()">
      Get Fee
    </button>
  </div>
</template>

<script>
import Web3 from 'web3';
import { ChainId, Fetcher, Trade, Route, TokenAmount, TradeType, Percent } from '@uniswap/sdk'
import IUniswapV2Router02 from './IUniswapV2Router02.json';
import ERC20 from './ERC20.json';
// account.json format
// {
//     "address": "",
//     "private": ""
// }
import account from '../account.json';
const Tx = require('ethereumjs-tx');

export default {
  name: 'App',
  data: function () {
    return {
      UNI: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
      WETH: '0xc778417e063141139fce010982780140aa0cd5ab',
      isMetamask: false,
    }
  },
  watch: {
    async isMetamask () {
      if (this.isMetamask) {
        await this.connectToMetaMask()
      } else {
        await this.connectByPrivateKey()
      }
    }
  },
  methods: {

    // Guide 11 - ==================================================
    async approve () {
      const trader = account.address;

      let web3 = window.web3
      let contract = await this.getContractInstance(web3);

      const token = new web3.eth.Contract(ERC20.abi, this.UNI);

      // 1. Approve
      const decimals = await token.methods.decimals().call();
      const amountIn = (1 * 10 ** decimals).toString();

      if (this.isMetamask) {
        // Call smart contract via metamask
        token.methods.approve(
          contract._address,
          amountIn
        ).send({ from: account.address });
      } else {
        // Call smart contract via private key
        const data = token.methods.approve(
          contract._address,
          amountIn
        );

        const params = {
          nonce: web3.utils.toHex(await web3.eth.getTransactionCount(trader)),
          gasLimit: web3.utils.toHex(await data.estimateGas({ from: trader })),
          gasPrice: web3.utils.toHex(await web3.eth.getGasPrice()),
          to: this.UNI,
          data: data.encodeABI(),
          value: '0x00' // 0
        }

        await this.signTransaction(params)
      }

    },
    // ============================================================


    // Guide 7 - ==================================================
    async swap () {
      const tokenForSwap = 1;
      const trader = account.address;

      let web3 = window.web3
      let contract = await this.getContractInstance(web3);

      const token = new web3.eth.Contract(ERC20.abi, this.UNI);

      const decimals = await token.methods.decimals().call();
      const amountIn = (tokenForSwap * 10 ** decimals).toString();

      // 2. Swap
      const path = [this.UNI, this.WETH];
      const amountOutMin = '0';

      if (this.isMetamask) {
        // Call smart contract via metamask
        contract.methods.swapExactTokensForETH(
          amountIn,
          amountOutMin,
          path,
          trader,
          Date.now() + 1000
        ).send({ from: account.address });;
      } else {
        // Call smart contract via private key
        const data = contract.methods.swapExactTokensForETH(
          amountIn,
          amountOutMin,
          path,
          trader,
          Date.now() + 1000
        );
        const params = {
          nonce: web3.utils.toHex(await web3.eth.getTransactionCount(trader)),
          gasLimit: web3.utils.toHex(await data.estimateGas({ from: trader })),
          gasPrice: web3.utils.toHex(await web3.eth.getGasPrice()),
          to: contract._address,
          data: data.encodeABI(),
          value: '0x00' // 0
        }

        await this.signTransaction(params);
      }
    },
    // ============================================================


    // Guide 1 2 4 5 - ==================================================
    async getBalance () {
      const eth = await window.web3.eth.getBalance(account.address)
      console.log(eth);
      const tokenContract = new window.web3.eth.Contract(ERC20.abi, this.UNI);
      const token = await tokenContract.methods.balanceOf(account.address).call()
      console.log(token)
    },
    // ============================================================


    // Guide 3 - ==================================================
    getAddress () {
      console.log(account.address)
    },
    // ============================================================


    // Guide 6 - ==================================================
    async getPrice () {
      const route = await this.getRoute()
      console.log(route.midPrice.toFixed()) // 1 weth = x uni
      console.log(route.midPrice.invert().toFixed()) // 1 uni = y weth
    },
    // ============================================================


    // Guide 8 - ==================================================
    async getMinimumReceived () {
      const trade = await this.getTrade();
      const slippageTolerance = new Percent('50', '10000') // 50 bips, or 0.50%
      console.log(trade.minimumAmountOut(slippageTolerance).toFixed())
    },
    // ============================================================


    // Guide 9 - ==================================================
    async getPriceImpact () {
      const trade = await this.getTrade();
      console.log(trade.priceImpact.toFixed())
    },
    // ============================================================


    // Guide 10 - ==================================================
    getFee () {
      const amount = 1;
      console.log(amount * 0.003)
    },
    // ============================================================


    async getRoute () {
      const tokenUni = await Fetcher.fetchTokenData(ChainId.RINKEBY, this.UNI)
      const tokenWeth = await Fetcher.fetchTokenData(ChainId.RINKEBY, this.WETH)
      const pair = await Fetcher.fetchPairData(tokenUni, tokenWeth)
      const route = new Route([pair], tokenWeth)
      return route
    },

    async getTrade () {
      const tokenUni = await Fetcher.fetchTokenData(ChainId.RINKEBY, this.UNI)
      const tokenWeth = await Fetcher.fetchTokenData(ChainId.RINKEBY, this.WETH)
      const pair = await Fetcher.fetchPairData(tokenUni, tokenWeth)
      const route = new Route([pair], tokenWeth)

      const amountIn = '1000000000000000000' // 1 WETH
      const trade = new Trade(route, new TokenAmount(tokenWeth, amountIn), TradeType.EXACT_INPUT)
      return trade
    },

    async signTransaction (params) {
      const tx = new Tx(params, { chain: 'rinkeby' });
      tx.sign(Buffer.from(account.private, 'hex'))
      const serializeTx = tx.serialize();
      await window.web3.eth.sendSignedTransaction('0x' + serializeTx.toString('hex'), function(err, hash) {
        if (!err) {
          console.log(hash);
        } else {
          console.log(err)
        }
      })
    },

    getContractInstance (web3Instance) {
      const router2Addr = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
      const contractAbi = IUniswapV2Router02.abi;
      return new web3Instance.eth.Contract(contractAbi, router2Addr);
    },

    getTokenContract (web3Instance, address) {
      const tokenAbi = ERC20.abi;
      return new web3Instance.eth.Contract(tokenAbi, address);
    },

    async connectToMetaMask() {
      if (window.ethereum) {
        window.web3 = new Web3(window.ethereum);
        await window.ethereum.enable();
      }
    },

    async connectByPrivateKey() {
      try {
        const provider = new Web3.providers.HttpProvider(
          'https://rinkeby.infura.io/v3/2806c626047f4fb590c7e20593b7dd73'
        );
        window.web3 = new Web3(provider);
      } catch (err) {

      }
    }
  },

  async mounted () {
    if (this.isMetamask) {
      await this.connectToMetaMask()
    } else {
      await this.connectByPrivateKey()
    }
  },
  created () {

  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
button {
  margin-right: 10px;
}
</style>
