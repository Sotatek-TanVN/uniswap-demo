import RouterV2 from './RouterV2.json';
import ERC20 from './ERC20.json';
import intermediaryTokens, { AMPL, DAI } from './IntermediaryTokens';
import {
    ChainId,
    WETH,
    JSBI,
    Percent,
} from "@uniswap/sdk";

export const INFURA = 'https://rinkeby.infura.io/v3/2806c626047f4fb590c7e20593b7dd73';
export const INFURA_KEY = '2806c626047f4fb590c7e20593b7dd73';
export const ROUTE_V2_ADDR = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
export const ROUTE_V2_ABI = RouterV2.abi;
export const ERC20_ABI = ERC20.abi;

export const CHAIN = 'rinkeby';
export const CHAIN_ID = 4;
// export const CHAIN = 'mainnet';
// export const CHAIN_ID = 1;

export const BETTER_TRADE_LESS_HOPS_THRESHOLD = new Percent(50, 10000);
export const MAX_HOPS = 3;
export const ALLOW_MULTIPLE_HOPS = true;

export const LOWEST_PRICE_IMPACT = new Percent(JSBI.BigInt(30), JSBI.BigInt(10000))
export const BASE_FEE = new Percent(JSBI.BigInt(30), JSBI.BigInt(10000))
export const ONE_HUNDRED_PERCENT = new Percent(JSBI.BigInt(10000), JSBI.BigInt(10000))
export const INPUT_FRACTION_AFTER_FEE = ONE_HUNDRED_PERCENT.subtract(BASE_FEE)

export const FACTORY_CONTRACT_ADDRESS = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f";

export const WETH_ONLY = {
    [ChainId.MAINNET]: [WETH[ChainId.MAINNET]],
    [ChainId.RINKEBY]: [WETH[ChainId.RINKEBY]],
    [ChainId.ROPSTEN]: [WETH[ChainId.ROPSTEN]],
    [ChainId.GÖRLI]: [WETH[ChainId.GÖRLI]],
    [ChainId.KOVAN]: [WETH[ChainId.KOVAN]]
};

// used to construct intermediary pairs for trading
export const BASES_TO_CHECK_TRADES_AGAINST = {
    ...WETH_ONLY,
    [ChainId.MAINNET]: [
        ...WETH_ONLY[ChainId.MAINNET],
        ...Object.values(intermediaryTokens)
    ]
};

export const CUSTOM_BASES = {
    [ChainId.MAINNET]: {
        [AMPL.address]: [DAI, WETH[ChainId.MAINNET]]
    }
};