<template>
  <div id="app">
    <button @click="showToken()">
      Show Token
    </button>
    <button @click="approve()">
      Approve
    </button>
    <button @click="swap()">
      Swap
    </button>
  </div>
</template>

<script>
import Web3 from 'web3';
import { ChainId, Token } from '@uniswap/sdk'
// Trade, Fetcher, , Route, TokenAmount, TradeType, Percent } from '@uniswap/sdk'
import IUniswapV2Router02 from './IUniswapV2Router02.json';
import ERC20 from './ERC20.json';
import account from './account.json';
const Tx = require('ethereumjs-tx');

export default {
  name: 'App',
  methods: {

    showToken () {
      const chainId = ChainId.RINKEBY
      const tokenAddress = '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984' // must be checksummed
      const decimals = 18

      const UNI = new Token(chainId, tokenAddress, decimals)
      console.log(chainId)
      console.log(UNI)
    },

    async approve () {
      const trader = account.address;
      const UNI = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984"

      let web3 = window.web3
      let contract = await this.getContractInstance(web3);

      const token = new web3.eth.Contract(ERC20.abi, UNI);

      const decimals = await token.methods.decimals().call();
      const amountIn = (1 * 10 ** decimals).toString();

      // 1. Approve
      const approveData = token.methods.approve(
        contract._address,
        amountIn
      );

      const approveTxParams = {
        nonce: web3.utils.toHex(await web3.eth.getTransactionCount(trader)),
        gasLimit: web3.utils.toHex(await approveData.estimateGas({ from: trader })),
        gasPrice: web3.utils.toHex(await web3.eth.getGasPrice()),
        to: UNI,
        data: approveData.encodeABI(),
        value: '0x00' // 0
      }

      const tx = new Tx(approveTxParams, { chain: 'rinkeby' });
      tx.sign(Buffer.from(account.private, 'hex'))
      const serializeTx = tx.serialize();
      await this.sendTransaction(serializeTx);
    },

    async swap () {
      const trader = account.address;
      const WETH = '0xc778417e063141139fce010982780140aa0cd5ab';
      const UNI = "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984"

      let web3 = window.web3
      let contract = await this.getContractInstance(web3);

      const token = new web3.eth.Contract(ERC20.abi, UNI);

      const decimals = await token.methods.decimals().call();
      const amountIn = (1 * 10 ** decimals).toString();

      // 2. Swap
      const path = [UNI, WETH];
      const amountOutMin = '0';

      const swapData = contract.methods.swapExactTokensForETH(
        amountIn,
        amountOutMin,
        path,
        trader,
        Date.now() + 1000
      );

      const swapParams = {
        nonce: web3.utils.toHex(await web3.eth.getTransactionCount(trader)),
        gasLimit: web3.utils.toHex(await swapData.estimateGas({ from: trader })),
        gasPrice: web3.utils.toHex(await web3.eth.getGasPrice()),
        to: contract._address,
        data: swapData.encodeABI(),
        value: '0x00' // 0
      }

      const tx = new Tx(swapParams, { chain: 'rinkeby' });
      tx.sign(Buffer.from(account.private, 'hex'))
      const serializeTx = tx.serialize();
      await this.sendTransaction(serializeTx);
    },

    async sendTransaction(serializeTx) {
      await window.web3.eth.sendSignedTransaction('0x' + serializeTx.toString('hex'), function(err, hash) {
        if (!err) {
          console.log(hash); // "0x7f9fade1c0d57a7af66ab4ead79fade1c0d57a7af66ab4ead7c2c2eb7b11a91385"
        } else {
          console.log(err)
        }
      })
    },

    getContractInstance(web3Instance) {
      const router2Addr = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
      const contractAbi = IUniswapV2Router02.abi;
      return new web3Instance.eth.Contract(contractAbi, router2Addr);
    },

    getTokenContract(web3Instance, address) {
      const tokenAbi = ERC20.abi;
      return new web3Instance.eth.Contract(tokenAbi, address);
    },
  },

  mounted () {
    window.web3 = new Web3(new Web3.providers.HttpProvider('https://rinkeby.infura.io/v3/2806c626047f4fb590c7e20593b7dd73'));
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
</style>
