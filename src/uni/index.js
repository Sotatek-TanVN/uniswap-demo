import Web3 from 'web3';
import { ChainId, Fetcher, Trade, Route, TokenAmount, TradeType, Percent, WETH as weth } from '@uniswap/sdk'
import { INFURA, ROUTE_V2_ADDR, ROUTE_V2_ABI, ERC20_ABI, CHAIN, CHAIN_ID } from './const.js'
const Tx = require('ethereumjs-tx');

const uni = {
  accAddress: process.env.VUE_APP_ADDRESS,
  privateKey: process.env.VUE_APP_PRIVATE,
  WETH: weth[CHAIN_ID].address,

  async connectToMetaMask() {
    if (window.ethereum) {
      window.web3 = new Web3(window.ethereum);
      await window.ethereum.enable();
    }
  },

  async connectByPrivateKey() {
    try {
      const provider = new Web3.providers.HttpProvider(INFURA);
      window.web3 = new Web3(provider);
    } catch (err) {
      console.log(err)
    }
  },

  getContractInstance(web3Instance) {
    return new web3Instance.eth.Contract(ROUTE_V2_ABI, ROUTE_V2_ADDR);
  },

  getTokenInstance(web3Instance, address) {
    return new web3Instance.eth.Contract(ERC20_ABI, address);
  },

  async signTransaction(params) {
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

  async approve(addressFrom, isPrivateKey) {
    let web3 = window.web3;

    const contract = this.getContractInstance(web3);
    const token = this.getTokenInstance(web3, addressFrom);

    const decimals = await token.methods.decimals().call();
    const amountIn = (1 * 10 ** decimals).toString();

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
  async swap(numberFrom, addressFrom, addressTo, isPrivateKey) {
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
  async getBalance(tokenAddress) {
    const eth = await window.web3.eth.getBalance(this.accAddress)
    console.log(eth);
    const tokenInstance = this.getTokenInstance(window.web3, tokenAddress);
    const token = await tokenInstance.methods.balanceOf(this.accAddress).call()
    console.log(token)
  },
  // ============================================================


  // Guide 3 - ==================================================
  getAddress() {
    console.log(this.accAddress)
  }, // ============================================================


  // Guide 6 - ==================================================
  async getPrice(addressFrom, addressTo) {
    const route = await this.getRoute(addressFrom, addressTo)
    console.log(route.midPrice.toFixed()) // 1 weth = x uni
    console.log(route.midPrice.invert().toFixed()) // 1 uni = y weth
  },
  // ============================================================


  // Guide 8 - ==================================================
  async getMinimumReceived(addressFrom, addressTo) {
    const trade = await this.getTrade(addressFrom, addressTo);
    const slippageTolerance = new Percent('50', '10000') // 50 bips, or 0.50%
    console.log(trade.minimumAmountOut(slippageTolerance).toFixed())
  },
  // ============================================================


  // Guide 9 - ==================================================
  async getPriceImpact(addressFrom, addressTo) {
    const trade = await this.getTrade(addressFrom, addressTo);
    console.log(trade.priceImpact.toFixed())
  },
  // ============================================================


  // Guide 10 - ==================================================
  getFee() {
    const amount = 1;
    console.log(amount * 0.003)
  },
  // ============================================================


  async getRoute(addressFrom, addressTo) {
    const tokenFrom = await Fetcher.fetchTokenData(ChainId.RINKEBY, addressFrom)
    const tokenTo = await Fetcher.fetchTokenData(ChainId.RINKEBY, addressTo)
    const pair = await Fetcher.fetchPairData(tokenFrom, tokenTo)
    const route = new Route([pair], tokenTo)
    return route
  },

  async getTrade(addressFrom, addressTo) {
    const tokenFrom = await Fetcher.fetchTokenData(ChainId.RINKEBY, addressFrom)
    const tokenTo = await Fetcher.fetchTokenData(ChainId.RINKEBY, addressTo)
    const pair = await Fetcher.fetchPairData(tokenFrom, tokenTo)
    const route = new Route([pair], tokenTo)

    const amountIn = '1000000000000000000' // 1 WETH
    const trade = new Trade(route, new TokenAmount(tokenTo, amountIn), TradeType.EXACT_INPUT)
    return trade
  },
}

export default uni;