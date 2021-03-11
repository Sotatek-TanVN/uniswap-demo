<template>
  <div id="app" v-if="connectBy">
    <input type="radio" v-model="methodConnect" :value="connectBy.PRIVATE_KEY">PrivateKey
    <input type="radio" v-model="methodConnect" :value="connectBy.META_MASK">Metamask
    <input type="radio" v-model="methodConnect" :value="connectBy.WALLET_CONNECT">Wallet Connect
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
    <!-- <button @click="getMinimumReceived()">
      Get Minimum Received
    </button>
    <button @click="getPriceImpact()">
      Get Price Impact
    </button>
    <button @click="getFee()">
      Get Fee
    </button> -->

    <div style="margin-top: 30px">

        <p>Currency In: </p>
        <input type="text" v-model="inputAmount">
        <select name="currencyIn" v-model="currencyIn" @change="onChange($event)">
          <option v-for="token in listToken" :value="token" :key="token.address">
            {{ token.symbol }} {{ token.address }}
          </option>
        </select>

        <p>Currency Out: </p>
        <input disabled type="text" v-model="outputAmount">
        <select name="currencyOut" v-model="currencyOut" @change="onChange($event)">
          <option v-for="token in listToken" :value="token" :key="token.address">
            {{ token.symbol }} {{ token.address }}
          </option>
        </select>

      <div v-if="!loadingRoute">
        <strong style="margin-top: 30px; display: inline-block" v-for="(p, index) in routes" :key="p.symbol">
          <span>{{p.symbol}}</span>
          <span style="margin: 0px 10px" v-if="index !== routes.length - 1">
            &nbsp;-
          </span>
        </strong>
        <div style="margin-top: 30px">
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
        Finding Route {{ currencyIn.symbol }} - {{ currencyOut.symbol }}
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
      realizedLPFee: 0,
      routes: [],
      fetchTradeInterval: 0,
      priceImpactDisplay: 0
    }
  },
  components: {
    ListTokens
  },
  watch: {
    async methodConnect () {
      await this.connectWallet()
    },
    from (value) {
      this.currencyIn.address = value.split(' ')[1]
    },
    to (value) {
      this.currencyOut.address = value.split(' ')[1]
    },
    // async inputAmount (value) {
    //   const route = await uni.getRoute(this.currencyIn.address, this.currencyOut.address)
    //   this.numberTo = route.midPrice.invert().toFixed() * value
    // },
  },
  methods: {
    getParams (currency) {
      const { address, chainId, decimals, name, symbol } = currency
      return [ chainId, address, decimals, symbol, name ]
    },

    fetchToShowBestTrade: async function() {
      const paramsIn = this.getParams(this.currencyIn)
      const tokenIn = new Token(...paramsIn);
      const paramsOut = this.getParams(this.currencyOut)
      const tokenOut = new Token(...paramsOut);

      const amountIn = this.inputAmount * (10 ** tokenIn.decimals);

      const { 
        routes,
        outputAmount,
        minimumAmountOut,
        priceImpact,
        realizedLPFee,
        priceImpactDisplay
      } = await uni.fetchToShowBestTrade(new TokenAmount(tokenIn, amountIn), tokenOut)

      this.routes = routes;
      this.outputAmount = outputAmount;
      this.minimumAmountOut = minimumAmountOut;
      this.priceImpact = priceImpact;
      this.realizedLPFee = realizedLPFee;
      this.priceImpactDisplay = priceImpactDisplay;
    },

    onChange: async function(e) {
      if (this.currencyIn && this.currencyOut) {
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
      await uni.approve(this.currencyIn.address, this.methodConnect == this.connectBy.PRIVATE_KEY);
    },

    async swap () {
      await uni.swap(this.inputAmount, this.currencyIn.address, this.currencyOut.address, this.methodConnect == this.connectBy.PRIVATE_KEY);
    },

    async getBalance () {
      await uni.getBalance(this.currencyIn.address, this.currencyOut.address);
    },

    getAddress () {
      uni.getAddress();
    },

    async getPrice () {
      await uni.getPrice(this.currencyIn.address, this.currencyOut.address);
    },

    // async getMinimumReceived () {
    //   await uni.getMinimumReceived(this.currencyIn.address, this.currencyOut.address);
    // },

    // async getPriceImpact () {
    //   await uni.getPriceImpact(this.currencyIn.address, this.currencyOut.address);
    // },

    // getFee () {
    //   uni.getFee();
    // },

    async connectWallet() {
      localStorage.removeItem('walletconnect');
      if(this.methodConnect == this.connectBy.META_MASK) {
        await uni.connectToMetaMask()
      } else if(this.methodConnect == this.connectBy.WALLET_CONNECT) {
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
