import Web3 from 'web3';
import { 
  ChainId,
  Fetcher,
  Trade,
  Route,
  TokenAmount,
  TradeType,
  Percent,
  WETH as weth,
  Pair,
  ETHER,
  Token,
  WETH,
  currencyEquals,
} from '@uniswap/sdk'
import {
  INFURA,
  INFURA_KEY,
  ROUTE_V2_ADDR,
  ROUTE_V2_ABI,
  ERC20_ABI,
  CHAIN,
  CHAIN_ID,
  BETTER_TRADE_LESS_HOPS_THRESHOLD,
  MAX_HOPS,
  ALLOW_MULTIPLE_HOPS,
  LOWEST_PRICE_IMPACT,
  ONE_HUNDRED_PERCENT,
  INPUT_FRACTION_AFTER_FEE,
  FACTORY_CONTRACT_ADDRESS,
  BASES_TO_CHECK_TRADES_AGAINST,
  CUSTOM_BASES
} from './const.js'
import flatMap from "lodash.flatmap";
import pairJson from "./pairABI.json";
import factoryJson from "./factoryABI.json";
import WalletConnectProvider from "@walletconnect/web3-provider";
import { ethers } from 'ethers';
import keythereum from 'keythereum';
import { Contract, Provider } from 'ethers-multicall';
const Tx = require('ethereumjs-tx');

const uni = {
  accAddress: process.env.VUE_APP_ADDRESS,
  privateKey: process.env.VUE_APP_PRIVATE,
  WETH: weth[CHAIN_ID].address,

  async connectToMetaMask () {
    if (window.ethereum) {
      window.web3 = new Web3(window.ethereum);
      await window.ethereum.enable();
    }
  },

  async connectByPrivateKey () {
    try {
      const provider = new Web3.providers.HttpProvider(INFURA);
      window.web3 = new Web3(provider);
    } catch (err) {
      console.log(err)
    }
  },

  async connectByWalletConnect () {
    try {
      const provider = new WalletConnectProvider({ rpc: { 4: INFURA } });

      await provider.enable();
      // Subscribe to accounts change
      provider.on("accountsChanged", (accounts) => {
        console.log(accounts);
      });

      // Subscribe to chainId change
      provider.on("chainChanged", (chainId) => {
        console.log(chainId);
      });

      // Subscribe to session connection
      provider.on("connect", () => {
        console.log("connect");
      });

      // Subscribe to session disconnection
      provider.on("disconnect", (code, reason) => {
        console.log(code, reason);
      });


      window.web3 = new Web3(provider);
    } catch (err) {
      console.log(err)
      // this.methodConnect = this.connectBy.PRIVATE_KEY
    }
  },

  getPrivateKeyFromMnemonic (mnemonic) {
    let mnemonicWallet = ethers.Wallet.fromMnemonic(mnemonic);
    console.log(mnemonicWallet.privateKey);
  },

  getPrivateKeyFromKeystore () {
    var keyobj = keythereum.importFromFile('0x...your..ether..address..', './Appdata/roaming/ethereum')

    var privateKey = keythereum.recover('your_password', keyobj) //this takes a few seconds to finish

    console.log(privateKey.toString('hex'));
  },

  getContractInstance (web3Instance) {
    return new web3Instance.eth.Contract(ROUTE_V2_ABI, ROUTE_V2_ADDR);
  },

  getTokenInstance (web3Instance, address) {
    return new web3Instance.eth.Contract(ERC20_ABI, address);
  },

  async signTransaction (params) {
    const tx = new Tx(params, { chain: CHAIN });
    tx.sign(Buffer.from(this.privateKey, 'hex'))
    const serializeTx = tx.serialize();
    await window.web3.eth.sendSignedTransaction('0x' + serializeTx.toString('hex'), function (err, hash) {
      if (!err) {
        console.log(hash);
      } else {
        console.log(err)
      }
    })
  },

  async approve (addressFrom, isPrivateKey) {
    let web3 = window.web3;

    const contract = this.getContractInstance(web3);
    const token = this.getTokenInstance(web3, addressFrom);

    const decimals = await token.methods.decimals().call();
    const amountIn = (999 * 10 ** decimals).toString();

    if (!isPrivateKey) {
      // Call smart contract via metamask
      token.methods.approve(
        contract._address,
        amountIn
      ).send({ from: this.accAddress });
    } else {
      // Call smart contract via private key
      const data = token.methods.approve(
        contract._address,
        amountIn
      );

      const params = {
        nonce: web3.utils.toHex(await web3.eth.getTransactionCount(this.accAddress)),
        gasLimit: web3.utils.toHex(await data.estimateGas({ from: this.accAddress })),
        gasPrice: web3.utils.toHex(await web3.eth.getGasPrice()),
        to: addressFrom,
        data: data.encodeABI(),
        value: '0x00' // 0
      }

      await this.signTransaction(params)
    }

  },
  // ============================================================


  // Guide 7 - ==================================================
  async swap (numberFrom, addressFrom, addressTo, isPrivateKey) {
    let web3 = window.web3;

    const contract = this.getContractInstance(web3);
    const token = this.getTokenInstance(web3, addressFrom);
    // const token = await new web3.eth.Contract(ERC20_ABI, addressFrom);

    const decimals = await token.methods.decimals().call();
    const amountIn = (numberFrom * 10 ** decimals).toString();

    const path = [addressFrom, addressTo];
    const amountOutMin = '0';

    let methodName = ''
    if (this.WETH == addressFrom) {
      methodName = 'swapExactETHForTokens'
    } else if (this.WETH == addressTo) {
      methodName = 'swapExactTokensForETH'
    } else {
      methodName = 'swapExactTokensForTokens'
    }

    const input1 = [amountIn]
    const input2 = [amountOutMin, path, this.accAddress, Date.now() + 1000]
    const input = this.WETH == addressFrom ? input2 : input1.concat(input2)

    if (!isPrivateKey) {
      // Call smart contract via metamask
      contract.methods[methodName](...input)
        .send(this.WETH == addressFrom
          ? { from: this.accAddress, value: amountIn }
          : { from: this.accAddress }
        )
    } else {
      // Call smart contract via private key
      const data = contract.methods[methodName](...input);
      const params = {
        nonce: web3.utils.toHex(await web3.eth.getTransactionCount(this.accAddress)),
        gasLimit: web3.utils.toHex(await data.estimateGas(
          { from: this.accAddress, value: this.WETH == addressFrom ? web3.utils.toHex(amountIn) : '0x00' }
        )),
        gasPrice: web3.utils.toHex(await web3.eth.getGasPrice()),
        to: contract._address,
        data: data.encodeABI(),
        value: this.WETH == addressFrom ? web3.utils.toHex(amountIn) : '0x00'
      }

      await this.signTransaction(params);
    }
  },
  // ============================================================


  // Guide 1 2 4 5 - ==================================================
  async getBalance (tokenAddress) {
    const eth = await window.web3.eth.getBalance(this.accAddress)
    console.log(eth);
    const tokenInstance = this.getTokenInstance(window.web3, tokenAddress);
    const token = await tokenInstance.methods.balanceOf(this.accAddress).call()
    console.log(token)
  },
  // ============================================================


  // Guide 3 - ==================================================
  getAddress () {
    console.log(this.accAddress)
  }, // ============================================================


  // Guide 6 - ==================================================
  async getPrice (addressFrom, addressTo) {
    const route = await this.getRoute(addressFrom, addressTo)
    console.log(route.midPrice.toFixed()) // 1 weth = x uni
    console.log(route.midPrice.invert().toFixed()) // 1 uni = y weth
  },
  // ============================================================


  // // Guide 8 - ==================================================
  // async getMinimumReceived (addressFrom, addressTo) {
  //   const trade = await this.getTrade(addressFrom, addressTo);
  //   const slippageTolerance = new Percent('50', '10000') // 50 bips, or 0.50%
  //   console.log(trade.minimumAmountOut(slippageTolerance).toFixed())
  // },
  // // ============================================================


  // // Guide 9 - ==================================================
  // async getPriceImpact (addressFrom, addressTo) {
  //   const trade = await this.getTrade(addressFrom, addressTo);
  //   console.log(trade.priceImpact.toFixed())
  // },
  // // ============================================================


  // // Guide 10 - ==================================================
  // getFee() {
  //   const amount = 1;
  //   console.log(amount * 0.003)
  // },
  // // ============================================================


  async getRoute (addressFrom, addressTo) {
    const tokenFrom = await Fetcher.fetchTokenData(ChainId.RINKEBY, addressFrom)
    const tokenTo = await Fetcher.fetchTokenData(ChainId.RINKEBY, addressTo)
    const pair = await Fetcher.fetchPairData(tokenFrom, tokenTo)
    const route = new Route([pair], tokenTo)
    return route
  },

  async getTrade (addressFrom, addressTo) {
    const tokenFrom = await Fetcher.fetchTokenData(ChainId.RINKEBY, addressFrom)
    const tokenTo = await Fetcher.fetchTokenData(ChainId.RINKEBY, addressTo)
    const pair = await Fetcher.fetchPairData(tokenFrom, tokenTo)
    const route = new Route([pair], tokenTo)

    const amountIn = '1000000000000000000' // 1 WETH
    const trade = new Trade(route, new TokenAmount(tokenTo, amountIn), TradeType.EXACT_INPUT)
    return trade
  },

  async fetchToShowBestTrade(currencyAmountIn, currencyOut) {
    const bestTrade = await this.findBestTradeExactIn(currencyAmountIn, currencyOut);

    const routes = bestTrade.route.path;
    const outputAmount = bestTrade.outputAmount.toFixed();
    const minimumAmountOut = bestTrade.minimumAmountOut(new Percent("10", "10000")).toFixed();

    const { priceImpactWithoutFee, realizedLPFee } = this.computeTradePriceBreakDown(bestTrade);
    const priceImpact = priceImpactWithoutFee.toFixed();
    const _realizedLPFee = realizedLPFee.toSignificant(4);
    const priceImpactDisplay = realizedLPFee.lessThan(LOWEST_PRICE_IMPACT) ? '<0.01' : priceImpact;

    return { routes, outputAmount, minimumAmountOut, priceImpact, realizedLPFee: _realizedLPFee, priceImpactDisplay }
  },

  computeTradePriceBreakDown (trade) {
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

  async findBestTradeExactIn (currencyAmountIn, currencyOut) {
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

  async getCommonPairs (currencyA, currencyB) {
    // Get all base tokens for intermediary by chain id ( network id )
    const bases = CHAIN_ID ? BASES_TO_CHECK_TRADES_AGAINST[CHAIN_ID] : [];
    const [tokenA, tokenB] = CHAIN_ID
      ? [
        this.getWrappedCurrency(currencyA),
        this.getWrappedCurrency(currencyB)
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

  getWrappedCurrency (currency) {
    return CHAIN_ID && currency === ETHER
      ? WETH[CHAIN_ID]
      : currency instanceof Token
        ? currency
        : undefined;
  },

  getAllPairCombinations ([tokenA, tokenB], basePairs) {
    const bases = CHAIN_ID ? BASES_TO_CHECK_TRADES_AGAINST[CHAIN_ID] : [];
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
          if (!CHAIN_ID) return true;
          const customBase = CUSTOM_BASES[CHAIN_ID];
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

  async getPairExists (currencies) {
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

  async getAllPairReserves (tokens) {
    const factoryContract = new Contract(
      FACTORY_CONTRACT_ADDRESS,
      factoryJson
    );

    const provider = new ethers.providers.InfuraProvider(CHAIN, INFURA_KEY);

    const ethcallProvider = new Provider(provider);

    await ethcallProvider.init();

    // Use for group multiple contract calls into one by using Multicall SmartContract and ethers lib
    const pairsExistContractCall = tokens.map(([tokenA, tokenB]) => factoryContract.getPair(tokenA.address, tokenB.address));

    let pairs = await ethcallProvider.all(pairsExistContractCall);

    // filter all the pair that doesn't has a pool
    const validTokenPairs = [];

    pairs = pairs.filter((pair, index) => {
      if (Number(pair) !== 0) {
        validTokenPairs.push(tokens[index]);
        return true;
      }
    });

    // Multicall smart contract for getting reserves of all pairs
    const pairsReserveContractCall = pairs.map(pair => {
      const pairContract = new Contract(pair, pairJson);

      return pairContract.getReserves();
    })

    let pairsWithReserves = await ethcallProvider.all(pairsReserveContractCall);

    return pairsWithReserves.map((pair, index) => {
      const [tokenA, tokenB] = validTokenPairs[index];
      const { _reserve0, _reserve1 } = pair;

      const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA];

      return new Pair(new TokenAmount(token0, _reserve0.toString()), new TokenAmount(token1, _reserve1.toString()));
    });
  },

  isTradeBetter (tradeA, tradeB, minimumDelta) {
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
}

export default uni;