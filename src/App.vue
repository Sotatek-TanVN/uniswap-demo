<template>
  <div id="app" v-if="connectBy">
    <input type="radio" v-model="methodConnect" :value="connectBy.PRIVATE_KEY">PrivateKey
    <input type="radio" v-model="methodConnect" :value="connectBy.META_MASK">Metamask
    <input type="radio" v-model="methodConnect" :value="connectBy.WALLET_CONNECT">Wallet Connect
    <br>
    <br>
    <br>
    <select v-model="from">
      <option v-for="token in listToken" :key="token.address">
        {{ token.symbol }} {{ token.address }}
      </option>
    </select>
    <select v-model="to">
      <option v-for="token in listToken" :key="token.address">
        {{ token.symbol }} {{ token.address }}
      </option>
    </select>
    <br>
    <br>
    <br>
    <input type="text" v-model="numberFrom">
    <input disabled type="text" v-model="numberTo">
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
    <TradingRoute />
    <ListTokens />
  </div>
</template>

<script>
import DEFAULT_TOKEN_LIST from './rinkebyToken.json'
import TradingRoute from './TradingRoute'
import ListTokens from './ListTokens'
import { ethers } from 'ethers';
import keythereum from 'keythereum';
import WalletConnectProvider from "@walletconnect/web3-provider";
import { METHOD_CONNECT } from './methodConnect'
import uni from './uni/index.js';
import Web3 from 'web3'

export default {
  name: 'App',
  data: function () {
    return {
      methodConnect: 1,
      from: '',
      to: '',
      listToken: DEFAULT_TOKEN_LIST,
      connectBy: METHOD_CONNECT,
      addressFrom: '',
      addressTo: '',
      numberFrom: '',
      numberTo: '',
      // account: account
    }
  },
  components: {
    TradingRoute,
    ListTokens
  },
  watch: {
    async methodConnect () {
      await this.connectWallet()
    },
    from (value) {
      this.addressFrom = value.split(' ')[1]
    },
    to (value) {
      this.addressTo = value.split(' ')[1]
    },
    async numberFrom (value) {
      const route = await uni.getRoute(this.addressFrom, this.addressTo)
      this.numberTo = route.midPrice.invert().toFixed() * value
    },
  },
  methods: {

    // Guide 11 - ==================================================
    async approve () {
      await uni.approve(this.addressFrom, this.methodConnect == this.connectBy.PRIVATE_KEY);
    },
    // ============================================================


    // Guide 7 - ==================================================
    async swap () {
      await uni.swap(this.numberFrom, this.addressFrom, this.addressTo, this.methodConnect == this.connectBy.PRIVATE_KEY);
    },
    // ============================================================


    // Guide 1 2 4 5 - ==================================================
    async getBalance () {
      await uni.getBalance(this.addressFrom, this.addressTo);
    },
    // ============================================================


    // Guide 3 - ==================================================
    getAddress () {
      uni.getAddress();
    },
    // ============================================================


    // Guide 6 - ==================================================
    async getPrice () {
      await uni.getPrice(this.addressFrom, this.addressTo);
    },
    // ============================================================


    // Guide 8 - ==================================================
    async getMinimumReceived () {
      await uni.getMinimumReceived(this.addressFrom, this.addressTo);
    },
    // ============================================================


    // Guide 9 - ==================================================
    async getPriceImpact () {
      await uni.getPriceImpact(this.addressFrom, this.addressTo);
    },
    // ============================================================


    // Guide 10 - ==================================================
    getFee () {
      uni.getFee();
    },
    // ============================================================

    async connectByWalletConnect() {
      try {
        const provider = new WalletConnectProvider({
          rpc: {
            4: "https://rinkeby.infura.io/v3/2806c626047f4fb590c7e20593b7dd73",
          },
        });

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
        this.methodConnect = this.connectBy.PRIVATE_KEY
      }
    },

    getPrivateKeyFromMnemonic (mnemonic) {
      let mnemonicWallet = ethers.Wallet.fromMnemonic(mnemonic);
      console.log(mnemonicWallet.privateKey);
    },

    getPrivateKeyFromKeystore () {
      var keyobj = keythereum.importFromFile('0x...your..ether..address..','./Appdata/roaming/ethereum')

      var privateKey = keythereum.recover('your_password', keyobj) //this takes a few seconds to finish

      console.log(privateKey.toString('hex'));
    },
    
    async connectWallet() {
      localStorage.removeItem('walletconnect');
      if(this.methodConnect == this.connectBy.META_MASK) {
        await uni.connectToMetaMask()
      } else if(this.methodConnect == this.connectBy.WALLET_CONNECT) {
        await this.connectByWalletConnect()
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
