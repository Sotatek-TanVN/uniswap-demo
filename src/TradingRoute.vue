<template>
  <div style="margin-top: 30px">
      <p>Currency In: </p>
      <select name="currencyIn" v-model="currencyIn" @change="onChange($event)">
        <option value="DAI">DAI</option>
        <option value="MKR">MKR</option>
        <option value="USDT">USDT</option>
        <option value="USDC">USDC</option>
        <option value="AMPL">AMPL</option>
        <option value="WBTC">WBTC</option>
        <option value="COMP">COMP</option>
      </select>
      <p>Currency Out: </p>
      <select name="currencyOut" v-model="currencyOut" @change="onChange($event)">
        <option value="DAI">DAI</option>
        <option value="MKR">MKR</option>
        <option value="USDT">USDT</option>
        <option value="USDC">USDC</option>
        <option value="AMPL">AMPL</option>
        <option value="WBTC">WBTC</option>
        <option value="COMP">COMP</option>
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
      Finding Route {{ currencyIn }} - {{ currencyOut }}
    </div>
  </div>
</template>
<script>
import intermediaryTokens from './IntermediaryTokens';
import DEFAULT_TOKEN_LIST from './rinkebyToken.json'
import { TokenAmount, Token } from "@uniswap/sdk";
import uni from './uni/index.js';

export default {
  name: 'TradingRoute',
  data: function () {
    return {
      currencyIn: null,
      currencyOut: null,
      loadingRoute: false,
      priceImpact: 0,
      outputAmount: 0,
      minimumAmountOut: 0,
      realizedLPFee: 0,
      routes: [],
      fetchTradeInterval: 0,
      priceImpactDisplay: 0
    }
  },
  mounted: async function() {
  },
  methods: {
    fetchToShowBestTrade: async function() {
      const WETH = new Token(
        4,
        "0xc778417E063141139Fce010982780140Aa0cD5Ab",
        18,
        "WETH",
        "Wrapped Ether"
      );
      const UNI = new Token(
        4,
        "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        18,
        "UNI",
        "Uniswap"
      );

      const { 
        routes,
        outputAmount,
        minimumAmountOut,
        priceImpact,
        realizedLPFee,
        priceImpactDisplay
      } = await uni.fetchToShowBestTrade(
        new TokenAmount(WETH, 0.2 * (10 ** WETH.decimals)),
        UNI
      )

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
  }
}

</script>
