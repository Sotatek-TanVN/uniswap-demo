<template>
  <div style="margin-top: 30px">
    <div v-if="bestTrade">
      <strong  v-for="p in bestTrade.route.path" :key="p.symbol">
        {{
          p.symbol
        }}
      </strong>
    </div>
  </div>
</template>
<script>
import Web3 from "web3";
import flatMap from "lodash.flatmap";
import pairJson from "./pairABI.json";
import factoryJson from "./factoryABI.json";
import { throttleRequests } from './throttleRequest';
import {
  Pair,
  ETHER,
  ChainId,
  Token,
  WETH,
  TokenAmount,
  currencyEquals,
  Percent,
  Trade
} from "@uniswap/sdk";


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

export const DAIRinkeby = new Token(
  ChainId.RINKEBY,
  "0x6D7F0754FFeb405d23C51CE938289d4835bE3b14",
  18,
  "cDAI",
  "Compound Dai"
);

const USDTRinkeby = new Token(
  ChainId.RINKEBY,
  "0xD9BA894E0097f8cC2BBc9D24D308b98e36dc6D02",
  18,
  "USDT",
  "Compound USD"
)

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
  "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2",
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
    USDC, USDT, COMP
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

const getContractInstance = (ABIContract, contractAddress) => {
  const windowObj = window;
  const {ethereum} = windowObj;
  if (ethereum && ethereum.isMetaMask) {
    const web3Instance = new Web3(ethereum);
    return new web3Instance.eth.Contract(ABIContract, contractAddress);
  } else if (windowObj.web3) {
    const web3Instance = new Web3(windowObj.web3.currentProvider);
    return new web3Instance.eth.Contract(ABIContract, contractAddress);
  } else {
    return null;
  }
};

const chainId = 1;

export default {
  name: 'TradingRoute',
  data: function () {
    return {
      bestTrade: null
    }
  },
  mounted: async function() {
    const bestTrade = await this.findBestTradeExactIn(new TokenAmount(USDC, 1), MKR);
    this.bestTrade = bestTrade;
  },
  methods: {
    getWrappedCurrency: function (currency, chainId) {
      return chainId && currency === ETHER
        ? WETH[chainId]
        : currency instanceof Token
        ? currency
        : undefined;
    },

    getAllPairReserves: async function (tokens) {
      const factoryContract = getContractInstance(
        factoryJson,
        factoryContractAddress
      );
      const returnReserves = [];
      const reservesPromise = [];

        for (let [tokenA, tokenB] of tokens) {
          const tokenReserve = async () => {
            const pairAddress = await factoryContract.methods
              .getPair(tokenA.address, tokenB.address)
              .call();

            if (Number(pairAddress) !== 0) {
              const pairContract = getContractInstance(pairJson, pairAddress);
              const reserves = await pairContract.methods.getReserves().call();

              const {_reserve0, _reserve1} = reserves;
              const [token0, token1] = tokenA.sortsBefore(tokenB)
                ? [tokenA, tokenB]
                : [tokenB, tokenA];

              returnReserves.push(
                new Pair(
                  new TokenAmount(token0, _reserve0.toString()),
                  new TokenAmount(token1, _reserve1.toString())
                )
              );
            }
          }

          reservesPromise.push(tokenReserve);
      }

      await throttleRequests(reservesPromise, 6); 

      return returnReserves;
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
      const allowedPairs = await this.getCommonPairs(
        currencyAmountIn.currency,
        currencyOut
      );
      if (allowedPairs.length > 0 && currencyAmountIn && currencyOut) {
        if (!ALLOW_MULTIPLE_HOPS) {
          return Trade.bestTradeExactIn(
            allowedPairs,
            currencyAmountIn,
            currencyOut,
            {
              maxHops: 1,
              maxNumResults: 1
            }
          )[0];
        }

        let bestTradeSoFar = null;

        for (let i = 1; i <= MAX_HOPS; i++) {
          const currentTrade =
            Trade.bestTradeExactIn(allowedPairs, currencyAmountIn, currencyOut, {
              maxHops: i,
              maxNumResults: 1
            })[0] ?? null;

          if (
            this.isTradeBetter(
              bestTradeSoFar,
              currentTrade,
              BETTER_TRADE_LESS_HOPS_THRESHOLD
            )
          ) {
            bestTradeSoFar = currentTrade;
          }
        }

        return bestTradeSoFar;
      }
    },
  }
}

</script>
