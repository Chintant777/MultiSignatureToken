const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultiSignature Tests", function() {

    async function loadInitialValues(){
        let amount = ethers.utils.parseEther("1");
        const [owner, add1, add2, add3] = await ethers.getSigners();
        const Token = await ethers.getContractFactory("MultiSig");
        const NUMBER_REQUIRED = 2;
        const owners = [owner.address, add1.address, add2.address];
        const deployToken = await Token.deploy(owners, NUMBER_REQUIRED);

        await deployToken.deployed();

        return { owner, add1, add2, add3, Token, owners, deployToken, amount, NUMBER_REQUIRED};
    }

    describe("Owner Validations", function(){
        it("Owners Length with address Comparision", async function() {
            const { owner, add1, add2, deployToken } = await loadFixture(loadInitialValues);
            expect(await deployToken.getOwners()).deep.equal([owner.address, add1.address, add2.address]);
        });

        it("Owners Length greater than equal to Number Required", async function() {
            const { NUMBER_REQUIRED, owners } = await loadFixture(loadInitialValues);

            expect(owners.length).to.be.gte(NUMBER_REQUIRED);
        });

        it("Can have unique Owners Only", async function() {
            const { Token, owner, add1, NUMBER_REQUIRED } = await loadFixture(loadInitialValues);

            await expect(Token.deploy([owner.address, add1.address, add1.address], NUMBER_REQUIRED)).to.be.revertedWith("owner address should be unique");
        });

        it("Smart Contract Address should not be in Owners", async function() {
            const { Token, owner, add1, NUMBER_REQUIRED } = await loadFixture(loadInitialValues);

            await expect(
                    Token.deploy([owner.address, ethers.constants.AddressZero, add1.address], NUMBER_REQUIRED)
                )
                .to.be.revertedWith("SC address cannot be owner address");
        });

        it("Owners Cannot empty", async function() {
            const { Token, NUMBER_REQUIRED } = await loadFixture(loadInitialValues);

            await expect(Token.deploy([], NUMBER_REQUIRED)).to.be.revertedWith("Owners cannot be empty");
        });
    });

    describe("Submit Transaction Validation", function(){    
        it("Submit Transaction", async function() {
            const {owner, add1, deployToken} = await loadFixture(loadInitialValues);
            
            expect(await deployToken.submitTransaction(add1.address, 1000, 0x1234))
                .to.emit(deployToken, "SubmitTransaction")
                .withArgs(owner.address, add1.address,await deployToken.getTransactionCount(),1000, 0x1234);
        });

        it("Submit Transaction to Only Owner", async function() {
            const { add1, add3, deployToken } = await loadFixture(loadInitialValues);
            
            await expect(deployToken.connect(add3).submitTransaction(add1.address, 1000, 0x1234))
                .to.be.revertedWith("current address is not owner");
        });
    });

    describe("Confirm Transactions", function(){

        let obj = null;

        before(async ()=>{
            obj = await loadFixture(loadInitialValues);
            await obj.deployToken.submitTransaction(obj.add1.address, 1000, 0x1234);
        })

        it("confirm Transaction", async function() {
            let {deployToken, owner} = obj;
    
            expect(await deployToken.confirmTransaction(0))
                .to.emit(deployToken, "ConfirmTransaction")
                .withArgs(owner.address, 0);
        });

        it("Confirm Transaction from Owner only", async function() {    
            let {deployToken, add3} = obj;

            await expect(deployToken.connect(add3).confirmTransaction(0))
                .to.be.revertedWith("current address is not owner");
        });

        it("Confirm Transaction from Existance Transaction only", async function() {      
            let {deployToken} = obj;     
            await expect(deployToken.confirmTransaction(1))
                .to.be.revertedWith("Transaction does not exist");
        });

        it("Cannot confirm already Confirmed Transaction", async function(){
            let {deployToken} = obj;

            await expect(deployToken.confirmTransaction(0))
                .to.be.revertedWith("Transaction is already confirmed");
        })
    });

    describe("Execute Transactions", function(){

        let obj = null;

        before(async ()=>{
            obj = await loadFixture(loadInitialValues);
            await obj.deployToken.submitTransaction(obj.add1.address, 1000, 0x1234);
            await obj.deployToken.confirmTransaction(0);
        })

        it("Execute Transaction from Owner only", async function() {  
            let { deployToken, add3 } = obj;           
            await expect(deployToken.connect(add3).confirmTransaction(0))
                .to.be.revertedWith("current address is not owner");
        });

        it("Execute Transaction from Existance Transaction only", async function() {   
            let { deployToken } = obj;        
            await expect(deployToken.confirmTransaction(1))
                .to.be.revertedWith("Transaction does not exist");
        });

        it("Cannot not Execute transaction if not met with required condition", async function(){
            let { deployToken } = obj;
            await expect(deployToken.executeTransaction(0))
                .to.be.revertedWith("Not get enouth no of confirmation to execute function");
        })

        it("Execute Transaction", async function() {
            let { owner, deployToken, add1, amount } = obj;

            await deployToken.connect(add1).confirmTransaction(0);

            let transactionData = await deployToken.getTransaction(0);
            
            await deployToken.DepositEth({value: amount});

            expect(await deployToken.executeTransaction(0))
                .to.emit(deployToken, "ExecuteTransaction")
                .withArgs(owner.address, transactionData.to, 0, transactionData.value, transactionData.data);
        });
    });

    describe("Revoke Transactions", function(){

        let obj = null;

        before(async ()=>{
            obj = await loadFixture(loadInitialValues);
            await obj.deployToken.submitTransaction(obj.add1.address, 1000, 0x1234);
            await obj.deployToken.confirmTransaction(0);
            await obj.deployToken.connect(obj.add1).confirmTransaction(0);
        })

        it("Revoke Transaction from Owner only", async function() {  
            let { deployToken, add3 } = obj;           
            await expect(deployToken.connect(add3).revokeConfirmationOfTransaction(0))
                .to.be.revertedWith("current address is not owner");
        });

        it("Revoke Transaction from Existance Transaction only", async function() {   
            let { deployToken } = obj;        
            await expect(deployToken.revokeConfirmationOfTransaction(1))
                .to.be.revertedWith("Transaction does not exist");
        });

        it("Revoke Transaction", async function() {
            let { owner, deployToken } = obj;

            expect(await deployToken.revokeConfirmationOfTransaction(0))
                .to.emit(deployToken, "RevokeTransaction")
                .withArgs(owner.address, 0);
        });

        it("Revoke Transaction only if Confirmed By Paticular Owner", async function() {
            let { add2, deployToken } = obj;

            await expect(deployToken.connect(add2).revokeConfirmationOfTransaction(0))
                .to.be.revertedWith("Transaction is not confirmed");               
        });

        it("Cannot not Revoke transaction if executed", async function(){
            let { deployToken, amount } = obj;
            
            await deployToken.confirmTransaction(0);

            await deployToken.DepositEth({value: amount});
            await deployToken.executeTransaction(0);

            await expect(deployToken.revokeConfirmationOfTransaction(0))
                .to.be.revertedWith("Executed Already");
        });
        
    });

    describe('Deposit', function () { 
        it("Deposit Ethers", async function() {
            const {deployToken, owner, amount} = await loadFixture(loadInitialValues);

            expect(await deployToken.DepositEth({value: amount}))
                .to.emit(deployToken, "Deposit")
                .withArgs(owner.address, ethers.utils.AddressZero, amount);
        });
    });
});