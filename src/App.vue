<template>
  <div id="app" v-if="connectBy">
    <input type="radio" v-model="methodConnect" :value="connectBy.PRIVATE_KEY">PrivateKey
    <input type="radio" v-model="methodConnect" :value="connectBy.META_MASK">Metamask
    <input type="radio" v-model="methodConnect" :value="connectBy.WALLET_CONNECT">Wallet Connect

    <div style="margin-top: 30px">

      <p>Currency In: </p>
      <input type="text" v-model="inputAmount" @change="onChangeInput($event)">
      <select name="currencyIn" v-model="currencyIn" @change="onChange($event)">
        <option v-for="token in listToken" :value="token" :key="token.address">
          {{ token.symbol }} {{ token.address }}
        </option>
      </select>

      <p>Currency Out: </p>
      <input type="text" v-model="outputAmount" @change="onChangeOutput($event)">
      <select name="currencyOut" v-model="currencyOut" @change="onChange($event)">
        <option v-for="token in listToken" :value="token" :key="token.address">
          {{ token.symbol }} {{ token.address }}
        </option>
      </select>
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

      <div v-if="!loadingRoute">
        <strong style="margin-top: 30px; display: inline-block" v-for="(p, index) in routes" :key="p.symbol">
          <span>{{p.symbol}}</span>
          <span style="margin: 0px 10px" v-if="index !== routes.length - 1">
            &nbsp;-
          </span>
        </strong>
        <div style="margin-top: 30px">
          Price: {{ midPrice }} {{ currencyOut && currencyOut.symbol }} per {{ currencyIn && currencyIn.symbol }}
        </div>
        <div>
          Price: {{ midPriceInvert }} {{ currencyIn && currencyIn.symbol }} per {{ currencyOut && currencyOut.symbol }}
        </div>
        <div>
          Price impact: {{ priceImpactDisplay }} %
        </div>
        <div>
          Liquidity Provider Fee: {{ realizedLPFee }} <strong v-if="routes && routes.length > 0">{{ routes[0].symbol }} </strong>
        </div>
        <div>
          Output (Estimated): {{ outputAmount }} <strong v-if="routes && routes.length > 0">{{ routes[routes.length - 1].symbol }} </strong>
        </div>
        <div>
          Minimum Received (Estimated): {{ minimumAmountOut }} <strong v-if="routes && routes.length > 0">{{ routes[routes.length - 1].symbol }} </strong>      
        </div>
      </div>
      <div v-if="loadingRoute">
        Loading ...
        Finding Route {{ currencyIn && currencyIn.symbol }} - {{ currencyOut && currencyOut.symbol }}
      </div>
    </div>

    <!-- <TradingRoute /> -->
    <ListTokens />
  </div>
</template>

<script>
import DEFAULT_TOKEN_LIST from './rinkebyToken.json'
import ListTokens from './ListTokens'
import { METHOD_CONNECT } from './methodConnect'
import uni from './uni/index.js';
import { TokenAmount, Token } from "@uniswap/sdk";

export default {
  name: 'App',
  data: function () {
    return {
      methodConnect: 1,
      from: '',
      to: '',
      listToken: DEFAULT_TOKEN_LIST,
      connectBy: METHOD_CONNECT,

      currencyIn: null,
      currencyOut: null,
      loadingRoute: false,
      priceImpact: 0,
      inputAmount: 0,
      outputAmount: 0,
      minimumAmountOut: 0,
      maximumAmountIn: 0,
      realizedLPFee: 0,
      routes: [],
      fetchTradeInterval: 0,
      priceImpactDisplay: 0,
      midPrice: 0,
      midPriceInvert: 0,

      isExactInput: true,
    }
  },
  components: {
    ListTokens
  },
  watch: {
    async methodConnect () {
      await this.connectWallet()
    },
  },
  methods: {
    async onChangeInput () {
      this.isExactInput = true
      await this.onChange()
    },

    async onChangeOutput () {
      this.isExactInput = false
      await this.onChange()
    },

    getParams (currency) {
      const { address, chainId, decimals, name, symbol } = currency
      return [ chainId, address, decimals, symbol, name ]
    },

    getToken (currencyIn, currencyOut) {
      const paramsIn = this.getParams(currencyIn)
      const tokenIn = new Token(...paramsIn);
      const paramsOut = this.getParams(currencyOut)
      const tokenOut = new Token(...paramsOut);
      return { tokenIn, tokenOut }
    },

    async fetchToShowBestTrade () {
      if (this.isExactInput) {
        await this.fetchToShowBestTradeExactIn()
      } else {
        await this.fetchToShowBestTradeExactOut()
      }
    },

    async fetchToShowBestTradeExactIn () {
      const { tokenIn, tokenOut } = this.getToken(this.currencyIn, this.currencyOut)
      const amountIn = this.inputAmount * (10 ** tokenIn.decimals);

      const { 
        routes,
        outputAmount,
        minimumAmountOut,
        priceImpact,
        realizedLPFee,
        priceImpactDisplay,
        midPrice,
        midPriceInvert
      } = await uni.fetchToShowBestTradeExactIn(new TokenAmount(tokenIn, amountIn), tokenOut)

      this.routes = routes;
      this.outputAmount = outputAmount;
      this.minimumAmountOut = minimumAmountOut;
      this.priceImpact = priceImpact;
      this.realizedLPFee = realizedLPFee;
      this.priceImpactDisplay = priceImpactDisplay;
      this.midPrice = midPrice;
      this.midPriceInvert = midPriceInvert;
    },
    
    async fetchToShowBestTradeExactOut () {
      const { tokenIn, tokenOut } = this.getToken(this.currencyIn, this.currencyOut)
      const amountOut = this.outputAmount * (10 ** tokenOut.decimals);

      const { 
        routes,
        inputAmount,
        maximumAmountIn,
        priceImpact,
        realizedLPFee,
        priceImpactDisplay,
        midPrice,
        midPriceInvert
      } = await uni.fetchToShowBestTradeExactOut(tokenIn, new TokenAmount(tokenOut, amountOut))

      this.routes = routes;
      this.inputAmount = inputAmount;
      this.maximumAmountIn = maximumAmountIn;
      this.priceImpact = priceImpact;
      this.realizedLPFee = realizedLPFee;
      this.priceImpactDisplay = priceImpactDisplay;
      this.midPrice = midPrice;
      this.midPriceInvert = midPriceInvert;
    },

    onChange: async function(e) {
      if (this.currencyIn && this.currencyOut && (this.inputAmount || this.outputAmount)) {
        if (this.fetchTradeInterval) {
          clearInterval(this.fetchTradeInterval);
          this.fetchTradeInterval = null;
        }

        this.loadingRoute = true;
        await this.fetchToShowBestTrade();
        this.loadingRoute = false;

        // Fetch estimate fee and slipppage again after 13 seconds to help user achieve best trade
        this.fetchTradeInterval = setInterval(() => {
          this.fetchToShowBestTrade();
        }, 13000);
      }
    },

    async approve () {
      await uni.approve(this.currencyIn.address, this.methodConnect == METHOD_CONNECT.PRIVATE_KEY);
    },

    async swap () {
      await uni.swap(this.inputAmount, this.currencyIn.address, this.currencyOut.address, this.methodConnect == METHOD_CONNECT.PRIVATE_KEY);
    },

    async getBalance () {
      await uni.getBalance(this.currencyIn.address, this.currencyOut.address);
    },

    async connectWallet() {
      localStorage.removeItem('walletconnect');
      if(this.methodConnect == METHOD_CONNECT.META_MASK) {
        await uni.connectToMetaMask()
      } else if(this.methodConnect == METHOD_CONNECT.WALLET_CONNECT) {
        await uni.connectByWalletConnect()
      } else {
        await uni.connectByPrivateKey()
      }
    },
  },

  async mounted () {
    await this.connectWallet()
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
button, select, input[type=text] {
  margin-right: 10px;
}
select, input[type=text] {
  width: 200px;
}
</style>
