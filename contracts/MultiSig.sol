// SPDX-License-Identifier: MIT
pragma solidity ^0.8.6;

contract MultiSig {
    event Deposit(address indexed sender, address indexed receiver, uint indexed amount);
    event SubmitTransaction(address indexed sender, address indexed receiver, uint indexed index, uint value, bytes data);
    event ConfirmTransaction(address indexed sender, uint indexed index);
    event RevokeTransaction(address indexed sender, uint indexed index);
    event ExecuteTransaction(address indexed sender, address indexed receiver, uint indexed index, uint value, bytes data);

    address[] public owners;
    mapping(address=>bool) isOwner;
    uint numConfirmationRequested;

    struct Transaction {
        address to;
        uint value;
        bytes data;
        bool isExecuted;
        uint numConfirmationCount;
    }

    mapping(uint => mapping(address => bool)) isConfirmed;
    Transaction[] transactions;

    modifier onlyOwner() {
        require(isOwner[msg.sender], "current address is not owner");
        _;
    }

    modifier txExists(uint txIndex) {
        require(txIndex < transactions.length, "Transaction does not exist");
        _;
    }

    modifier notExecuted(uint txIndex) {
        require(!transactions[txIndex].isExecuted, "Executed Already");
        _;
    }

    modifier notConfirmed(uint txIndex) {
        require(!isConfirmed[txIndex][msg.sender], "Transaction is already confirmed");
        _;
    }

    constructor(address[] memory _owners, uint _numConfirmationRequested) {
        require(_owners.length> 0, "Owners cannot be empty");
        require(
            _numConfirmationRequested>0 && _numConfirmationRequested <= _owners.length, 
            "Invalid Operation in constructor"
        );
        
        for(uint i=0; i<_owners.length; i++){
            address owner = _owners[i];
            require(owner!=address(0), "SC address cannot be owner address");
            require(!isOwner[owner], "owner address should be unique");
            isOwner[owner] = true;
            owners.push(owner);
        }

        numConfirmationRequested = _numConfirmationRequested;
    }

    function confirmTransaction(uint txIndex) public 
        onlyOwner txExists(txIndex) notConfirmed(txIndex)
    {
        Transaction storage tx = transactions[txIndex];
        tx.numConfirmationCount += 1;
        isConfirmed[txIndex][msg.sender] = true;

        emit ConfirmTransaction(msg.sender, txIndex);
    }

    function submitTransaction(address _to, uint _value, bytes memory _data) public onlyOwner
    {
        transactions.push(
            Transaction({
                to: _to,
                value: _value,
                data: _data,
                isExecuted: false,
                numConfirmationCount: 0
            })
        );

        emit SubmitTransaction(msg.sender, _to, transactions.length, _value, _data);
    }
    
    receive() external payable {}
    
    function DepositEth() public payable {
        (bool success, bytes memory data) = payable(address(this)).call{value: msg.value}("");
        require(success, "Invalid Deposit Method");
        emit Deposit(msg.sender, address(this), msg.value);
    }

    function executeTransaction(uint txIndex) public 
        onlyOwner txExists(txIndex) notExecuted(txIndex) 
    {
        Transaction storage tx = transactions[txIndex];
        require(
            tx.numConfirmationCount >= numConfirmationRequested, 
            "Not get enouth no of confirmation to execute function"
        );
        
        (bool success, bytes memory data) = payable(tx.to).call{gas: 30000, value: tx.value}("");
        require(success, "Cannot execute function");

        tx.isExecuted = true;

        emit ExecuteTransaction(msg.sender, tx.to, txIndex, tx.value, tx.data);
    }

    function revokeConfirmationOfTransaction(uint txIndex) public
        onlyOwner txExists(txIndex) notExecuted(txIndex) 
    {
        Transaction storage tx = transactions[txIndex];
        require(isConfirmed[txIndex][msg.sender], "Transaction is not confirmed");
        isConfirmed[txIndex][msg.sender] = false;
        tx.numConfirmationCount -= 1;

        emit RevokeTransaction(msg.sender, txIndex);
    }

    function getOwners() public view onlyOwner returns(address[] memory){
        return owners;
    }

    function getTransactionCount() public view returns(uint) {
        return transactions.length;
    }

    function getTransaction(uint txIndex) public view returns(Transaction memory) {
        return transactions[txIndex];
    }
}