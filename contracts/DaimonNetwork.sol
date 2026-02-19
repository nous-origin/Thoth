// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * DaimonNetwork Registry
 * 
 * a simple onchain registry for autonomous agents.
 * every daimon registers here, making the network discoverable.
 * 
 * the registry is permissionless — anyone can register.
 * reputation and trust are emergent, not enforced.
 */
contract DaimonNetwork {
    struct Agent {
        string repoUrl;      // github repo (or any url)
        address wallet;      // onchain identity
        string name;         // display name
        uint256 registeredAt;
        uint256 lastSeen;    // updated each heartbeat
    }
    
    mapping(address => Agent) public agents;
    address[] public agentList;
    
    event AgentRegistered(address indexed wallet, string repoUrl, string name);
    event Heartbeat(address indexed wallet, uint256 timestamp);
    
    /**
     * register a new daimon
     * @param repoUrl the agent's source code repository
     * @param name display name for this agent
     */
    function register(string calldata repoUrl, string calldata name) external {
        require(bytes(repoUrl).length > 0, "repo url required");
        require(bytes(name).length > 0, "name required");
        require(bytes(agents[msg.sender].repoUrl).length == 0, "already registered");
        
        agents[msg.sender] = Agent({
            repoUrl: repoUrl,
            wallet: msg.sender,
            name: name,
            registeredAt: block.timestamp,
            lastSeen: block.timestamp
        });
        agentList.push(msg.sender);
        
        emit AgentRegistered(msg.sender, repoUrl, name);
    }
    
    /**
     * signal that this daimon is still alive
     * should be called each cycle
     */
    function heartbeat() external {
        require(bytes(agents[msg.sender].repoUrl).length != 0, "not registered");
        agents[msg.sender].lastSeen = block.timestamp;
        
        emit Heartbeat(msg.sender, block.timestamp);
    }
    
    /**
     * get the total number of registered daimons
     */
    function count() external view returns (uint256) {
        return agentList.length;
    }
    
    /**
     * get all registered daimons
     * warning: gas-intensive for large networks
     */
    function getAll() external view returns (Agent[] memory) {
        Agent[] memory all = new Agent[](agentList.length);
        for (uint256 i = 0; i < agentList.length; i++) {
            all[i] = agents[agentList[i]];
        }
        return all;
    }
    
    /**
     * get a paginated list of daimons
     * @param offset starting index
     * @param limit max number to return
     */
    function getPage(uint256 offset, uint256 limit) external view returns (Agent[] memory) {
        require(offset < agentList.length, "offset out of bounds");
        
        uint256 end = offset + limit;
        if (end > agentList.length) {
            end = agentList.length;
        }
        
        uint256 len = end - offset;
        Agent[] memory page = new Agent[](len);
        for (uint256 i = 0; i < len; i++) {
            page[i] = agents[agentList[offset + i]];
        }
        return page;
    }
}
