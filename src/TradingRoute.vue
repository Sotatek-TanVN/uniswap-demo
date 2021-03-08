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
    <div v-if="!bestTradeSoFar && !loadingRoute">
      <strong style="margin-top: 30px; display: inline-block" v-for="(p, index) in routes" :key="p.symbol">
        <span>{{p.symbol}}</span>
        <span style="margin: 0px 10px" v-if="index !== routes.length - 1">
           &nbsp;-
        </span>
      </strong>
      <div style="margin-top: 30px">
        Price impact: {{ priceImpact }} %
      </div>
      <div>
        Liquidity Provider Fee: {{ realizedLPFee }} <strong v-if="routes && routes.length > 0">{{ routes[0].symbol }} </strong>
      </div>
      <div>
        Output (Estimated): {{ outputAmount }}
      </div>
      <div>
        Minimum Received (Estimated): {{ minimumAmountOut }} <strong v-if="routes && routes.length > 0">{{ routes[routes.length - 1].symbol }} </strong>      
      </div>
    </div>
    <div v-if="loadingRoute && !bestTradeSoFar">
      Loading ...
      Finding Route {{ currencyIn }} - {{ currencyOut }}
    </div>
  </div>
</template>
<script>
import Web3 from "web3";
import flatMap from "lodash.flatmap";
import pairJson from "./pairABI.json";
import factoryJson from "./factoryABI.json";
import {
  Pair,
  ETHER,
  ChainId,
  Token,
  WETH,
  TokenAmount,
  currencyEquals,
  Trade,
  JSBI,
  Percent,
  Fraction
} from "@uniswap/sdk";

import { Contract, Provider } from 'ethers-multicall';
import { ethers } from 'ethers';


const BETTER_TRADE_LESS_HOPS_THRESHOLD = new Percent(50, 10000);
const MAX_HOPS = 3;
const ALLOW_MULTIPLE_HOPS = true;

const factoryContractAddress = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";

export const DAI = new Token(
  ChainId.MAINNET,
  "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  18,
  "DAI",
  "Dai Stablecoin"
);

export const USDC = new Token(
  ChainId.MAINNET,
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  6,
  "USDC",
  "USD//C"
);
export const USDT = new Token(
  ChainId.MAINNET,
  "0xdac17f958d2ee523a2206206994597c13d831ec7",
  6,
  "USDT",
  "Tether USD"
);
export const COMP = new Token(
  ChainId.MAINNET,
  "0xc00e94Cb662C3520282E6f5717214004A7f26888",
  18,
  "COMP",
  "Compound"
);
export const MKR = new Token(
  ChainId.MAINNET,
  "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2",
  18,
  "MKR",
  "Maker"
);
export const AMPL = new Token(
  ChainId.MAINNET,
  "0xD46bA6D942050d489DBd938a2C909A5d5039A161",
  9,
  "AMPL",
  "Ampleforth"
);
export const WBTC = new Token(
  ChainId.MAINNET,
  "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  8,
  "WBTC",
  "Wrapped BTC"
);

const tokens = {
  DAI, USDC, USDT, COMP, MKR, WBTC
}

const WETH_ONLY = {
  [ChainId.MAINNET]: [WETH[ChainId.MAINNET]],
  [ChainId.RINKEBY]: [WETH[ChainId.RINKEBY]],
  [ChainId.ROPSTEN]: [WETH[ChainId.ROPSTEN]],
  [ChainId.GÖRLI]: [WETH[ChainId.GÖRLI]],
  [ChainId.KOVAN]: [WETH[ChainId.KOVAN]]
};

// used to construct intermediary pairs for trading
const BASES_TO_CHECK_TRADES_AGAINST = {
  ...WETH_ONLY,
  [ChainId.MAINNET]: [
    ...WETH_ONLY[ChainId.MAINNET], 
    DAI, USDC, USDT, COMP, MKR, WBTC
  ]
};

/**
* Some tokens can only be swapped via certain pairs, so we override the list of bases that are considered for these
* tokens.
*/
export const CUSTOM_BASES = {
  [ChainId.MAINNET]: {
    [AMPL.address]: [DAI, WETH[ChainId.MAINNET]]
  }
};

const chainId = 1;

const BASE_FEE = new Percent(JSBI.BigInt(30), JSBI.BigInt(10000))
const ONE_HUNDRED_PERCENT = new Percent(JSBI.BigInt(10000), JSBI.BigInt(10000))
const INPUT_FRACTION_AFTER_FEE = ONE_HUNDRED_PERCENT.subtract(BASE_FEE)

export default {
  name: 'TradingRoute',
  data: function () {
    return {
      bestTradeSoFar: null,
      currencyIn: null,
      currencyOut: null,
      loadingRoute: false,
      priceImpact: 0,
      outputAmount: 0,
      minimumAmountOut: 0,
      realizedLPFee: 0,
      routes: [],
    }
  },
  mounted: async function() {
  },
  methods: {
    onChange: async function(e) {
      if (this.currencyIn && this.currencyOut) {
        const bestTrade = await this.findBestTradeExactIn(new TokenAmount(tokens[this.currencyIn], 250000 * Math.pow(10, tokens[this.currencyIn].decimals)), tokens[this.currencyOut]);

        this.priceImpact = bestTrade.priceImpact.toFixed();
        this.routes = bestTrade.route.path;
        this.outputAmount = bestTrade.outputAmount.toFixed();
        this.minimumAmountOut = bestTrade.minimumAmountOut(new Percent("10", "10000")).toFixed();

        const { priceImpactWithoutFee, realizedLPFee } = this.computeTradePriceBreakDown(bestTrade);
        this.priceImpact = priceImpactWithoutFee.toFixed();
        this.realizedLPFee = realizedLPFee.toSignificant(4);

        this.loadingRoute = false;
      }
    },
    computeTradePriceBreakDown: function (trade) {
      if (trade) {
        const realizedLPFee = ONE_HUNDRED_PERCENT.subtract(trade.route.pairs.reduce((currentFee, pair) => currentFee.multiply(INPUT_FRACTION_AFTER_FEE), ONE_HUNDRED_PERCENT));
        const { numerator, denominator } = trade.priceImpact.subtract(realizedLPFee);
        const priceImpactWithoutFeePercent = new Percent(numerator, denominator);
        const realizedLPAmount = new TokenAmount(trade.inputAmount.token, realizedLPFee.multiply(trade.inputAmount.raw).quotient);
        
        return { 
          priceImpactWithoutFee: priceImpactWithoutFeePercent,
          realizedLPFee: realizedLPAmount
        };
      }

      return undefined;
    },
    getWrappedCurrency: function (currency, chainId) {
      return chainId && currency === ETHER
        ? WETH[chainId]
        : currency instanceof Token
        ? currency
        : undefined;
    },

    getAllPairReserves: async function (tokens) {
      const factoryContract = new Contract(
        factoryContractAddress,
        factoryJson
      );

      const infuraKey = '521064ae8d384c8fa6ddcf47f8ffc0fd';

      const provider = new ethers.providers.InfuraProvider('mainnet', infuraKey);

      const ethcallProvider = new Provider(provider);

      await ethcallProvider.init(); 

      // Use for group multiple contract calls into one by using Multicall SmartContract and ethers lib
      const pairsExistContractCall = tokens.map(([tokenA, tokenB]) => factoryContract.getPair(tokenA.address, tokenB.address));

      let pairs  = await ethcallProvider.all(pairsExistContractCall);

      // filter all the pair that doesn't has a pool
      const validTokenPairs = [];

      pairs = pairs.filter((pair, index) => { 
        if(Number(pair) !== 0) {
          validTokenPairs.push(tokens[index]);
          return true;
        } 
      });

      // Multicall smart contract for getting reserves of all pairs
      const pairsReserveContractCall = pairs.map(pair => {
        const pairContract = new Contract(pair, pairJson);

        return pairContract.getReserves();
      })

      let pairsWithReserves  = await ethcallProvider.all(pairsReserveContractCall);

      return pairsWithReserves.map((pair, index) => {
        const [tokenA, tokenB] = validTokenPairs[index];
        const { _reserve0, _reserve1 } = pair;

        const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB]: [tokenB, tokenA];

        return new Pair(new TokenAmount(token0, _reserve0.toString()), new TokenAmount(token1, _reserve1.toString()));
      });
    },

    getPairExists: async function (currencies) {
      const tokens = currencies.map(([currencyA, currencyB]) => {
        return [this.getWrappedCurrency(currencyA), this.getWrappedCurrency(currencyB)];
      });

      const pairsWithReserves = await this.getAllPairReserves(tokens);

      return Object.values(
        pairsWithReserves.reduce((memo, current) => {
          memo[current.liquidityToken.address] =
            memo[current.liquidityToken.address] ?? current;

          return memo;
        }, {})
      );
    },

    getAllPairCombinations: function ([tokenA, tokenB], basePairs) {
      const bases = chainId ? BASES_TO_CHECK_TRADES_AGAINST[chainId] : [];
      return tokenA && tokenB
        ? [
          [tokenA, tokenB],
          ...bases.map((base) => [tokenA, base]),
          ...bases.map((base) => [tokenB, base]),
          ...basePairs
        ]
        .filter((tokens) => Boolean(tokens[0] && tokens[1]))
        .filter(([t0, t1]) => t0.address !== t1.address)
        .filter(([tokenA, tokenB]) => {
          if (!chainId) return true;
          const customBase = CUSTOM_BASES[chainId];
          if (!customBase) return true;

          const customBaseA = customBase[tokenA.address];
          const customBaseB = customBase[tokenB.address];

          if (!customBaseA && !customBaseB) return true;

          if (customBaseA && !customBaseA.find((base) => tokenA.equals(base))) {
            return false;
          }

          if (customBaseB && !customBaseB.find((base) => tokenB.equals(base))) {
            return false;
          }

          return true;
        })
        : [];
    },

    getCommonPairs: async function (currencyA, currencyB) {
      // Get all base tokens for intermediary by chain id ( network id )
      const bases = chainId ? BASES_TO_CHECK_TRADES_AGAINST[chainId] : [];
      const [tokenA, tokenB] = chainId
        ? [
          this.getWrappedCurrency(currencyA, chainId),
          this.getWrappedCurrency(currencyB, chainId)
        ]
        : [undefined, undefined];

      const basePairs = flatMap(bases, (base) => {
        return bases
          .map((otherBase) => [base, otherBase])
          .filter(([t0, t1]) => t0.address !== t1.address);
      });

      const allPairsCombination = this.getAllPairCombinations(
        [tokenA, tokenB],
        basePairs
      );

      const allPairs = await this.getPairExists(allPairsCombination);

      return allPairs;
    },

    isTradeBetter: function (tradeA, tradeB, minimumDelta) {
      const ZERO_PERCENT = new Percent("0");
      const ONE_HUNDRED_PERCENT = new Percent("1");

      if (tradeA && !tradeB) return false;
      if (tradeB && !tradeA) return true;
      if (!tradeA || !tradeB) return undefined;

      if (
        tradeA.tradeType !== tradeB.tradeType ||
        !currencyEquals(tradeA.inputAmount.currency, tradeB.inputAmount.currency) ||
        !currencyEquals(tradeA.outputAmount.currency, tradeB.outputAmount.currency)
      ) {
        throw new Error("Trades are not comparable");
      }

      if (minimumDelta === ZERO_PERCENT) {
        return tradeA.executionPrice.lessThan(tradeB.executionPrice);
      } else {
        return tradeA.executionPrice.raw
          .multiply(minimumDelta.add(ONE_HUNDRED_PERCENT))
          .lessThan(tradeB.executionPrice);
      }
    },

    findBestTradeExactIn : async function (currencyAmountIn, currencyOut) {
      this.loadingRoute = true;

      const allowedPairs = await this.getCommonPairs(
        currencyAmountIn.currency,
        currencyOut
      );

      if (currencyAmountIn && currencyOut && allowedPairs.length > 0) {
        if (!ALLOW_MULTIPLE_HOPS) {
          return (
            Trade.bestTradeExactIn(allowedPairs, currencyAmountIn, currencyOut, { maxHops: 1, maxNumResults: 1 })[0] ??
            null
          )
        }
        // search through trades with varying hops, find best trade out of them
        let bestTradeSoFar = null
        for (let i = 1; i <= MAX_HOPS; i++) {
          const currentTrade =
            Trade.bestTradeExactIn(allowedPairs, currencyAmountIn, currencyOut, { maxHops: i, maxNumResults: 1 })[0] ??
            null

          // if current trade is best yet, save it
          if (this.isTradeBetter(bestTradeSoFar, currentTrade, BETTER_TRADE_LESS_HOPS_THRESHOLD)) {
            bestTradeSoFar = currentTrade
          }
        }

        return bestTradeSoFar
      }
    },
  }
}

</script>
