require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");
require('dotenv').config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.17",
  gasReporter: {
    enabled: true,
    currency: process.env.CURRENCY,
    noColors: true,
    coinmarketcap: process.env.COINCAP_MARKET_API_KEY,
    outputFile: "gas-report.txt",
    token: process.env.TOKEN
  }
};
