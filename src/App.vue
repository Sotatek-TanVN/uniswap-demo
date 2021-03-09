<template>
  <div id="app">
    <input type="radio" v-model="isMetamask" value="false">PrivateKey
    <input type="radio" v-model="isMetamask" value="true">Metamask
    <br>
    <br>
    <br>
    <select v-model="from">
      <option v-for="token in listToken">
        {{ token.symbol }} {{ token.address }}
      </option>
    </select>
    <select v-model="to">
      <option v-for="token in listToken">
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
import uni from './uni/index.js';

export default {
  name: 'App',
  data: function () {
    return {
      isMetamask: false,
      from: '',
      to: '',
      listToken: DEFAULT_TOKEN_LIST,
      addressFrom: '',
      addressTo: '',
      numberFrom: '',
      numberTo: '',
    }
  },
  components: {
    TradingRoute,
    ListTokens
  },
  watch: {
    async isMetamask () {
      if (this.isMetamask) {
        await uni.connectToMetaMask()
      } else {
        await uni.connectByPrivateKey()
      }
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
      await uni.approve(this.addressFrom, this.isMetamask);
    },
    // ============================================================


    // Guide 7 - ==================================================
    async swap () {
      await uni.swap(this.numberFrom, this.addressFrom, this.addressTo, this.isMetamask);
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

    getPrivateKeyFromMnemonic (mnemonic) {
      let mnemonicWallet = ethers.Wallet.fromMnemonic(mnemonic);
      console.log(mnemonicWallet.privateKey);
    },

    getPrivateKeyFromKeystore () {
      var keyobj = keythereum.importFromFile('0x...your..ether..address..','./Appdata/roaming/ethereum')

      var privateKey = keythereum.recover('your_password', keyobj) //this takes a few seconds to finish

      console.log(privateKey.toString('hex'));
    }
  },

  async mounted () {
    if (this.isMetamask) {
      await uni.connectToMetaMask()
    } else {
      await uni.connectByPrivateKey()
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
button, select, input[type=text] {
  margin-right: 10px;
}
select, input[type=text] {
  width: 200px;
}
</style>
