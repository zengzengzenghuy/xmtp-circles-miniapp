import React, { useState, useEffect } from "react";
import {
  getGroupsInfo,
  createBaseGroup,
  BASE_GROUP_FACTORY_ADDRESS,
  BASE_GROUP_FACTORY_ABI,
} from "../helpers/groupOperations";
import { useWalletClient } from "wagmi";
import { encodeFunctionData } from "viem";

function CirclesGroup({ address }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form state for creating a group
  const [formData, setFormData] = useState({
    owner: "",
    service: "",
    feeCollection: "",
    initialConditions: "",
    name: "",
    symbol: "",
    metadataDigest: "",
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  const { data: walletClient } = useWalletClient();

  useEffect(() => {
    const fetchGroupMemberships = async () => {
      if (!address) {
        setGroups([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch group memberships
        const membershipResponse = await fetch(
          "https://staging.circlesubi.network/",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "circles_getGroupMemberships",
              params: [address],
            }),
          },
        );

        const membershipData = await membershipResponse.json();

        if (!membershipData.result || !membershipData.result.results) {
          setGroups([]);
          return;
        }

        const memberships = membershipData.result.results;

        if (memberships.length === 0) {
          setGroups([]);
          return;
        }

        // Extract group addresses for on-chain query
        const groupAddresses = memberships.map((m) => m.group);

        // Fetch on-chain group info
        let groupsOnChainInfo = [];
        try {
          groupsOnChainInfo = await getGroupsInfo(groupAddresses);
          console.log("On-chain group info:", groupsOnChainInfo);
        } catch (err) {
          console.error("Error fetching on-chain group info:", err);
          // Continue without on-chain info if it fails
        }

        // Fetch profile for each group and combine with on-chain info
        const groupProfiles = await Promise.all(
          memberships.map(async (membership, index) => {
            try {
              const profileResponse = await fetch(
                "https://staging.circlesubi.network/",
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "circles_getProfileView",
                    params: [membership.group],
                  }),
                },
              );

              const profileData = await profileResponse.json();

              // Get on-chain info for this group
              const onChainInfo = groupsOnChainInfo[index];

              // Determine membership status
              let membershipStatus = "Member";
              if (onChainInfo && onChainInfo.owner) {
                const isOwner =
                  onChainInfo.owner.toLowerCase() === address.toLowerCase();
                membershipStatus = isOwner ? "Group Owner" : "Member";
              }

              if (profileData.result && profileData.result.profile) {
                return {
                  address: membership.group,
                  name: profileData.result.profile.name || "Unnamed Group",
                  description:
                    profileData.result.profile.description || "No description",
                  membershipStatus,
                  owner: onChainInfo?.owner || null,
                };
              }

              return {
                address: membership.group,
                name: "Unnamed Group",
                description: "No description",
                membershipStatus,
                owner: onChainInfo?.owner || null,
              };
            } catch (err) {
              console.error(
                `Error fetching profile for group ${membership.group}:`,
                err,
              );
              return {
                address: membership.group,
                name: "Unnamed Group",
                description: "No description",
                membershipStatus: "Member",
                owner: null,
              };
            }
          }),
        );

        setGroups(groupProfiles);
      } catch (err) {
        console.error("Error fetching group memberships:", err);
        setError("Failed to load groups");
      } finally {
        setLoading(false);
      }
    };

    fetchGroupMemberships();
  }, [address]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateGroup = async () => {
    if (!walletClient) {
      setCreateError("Please connect your wallet first");
      return;
    }

    if (
      !formData.owner ||
      !formData.service ||
      !formData.feeCollection ||
      !formData.name ||
      !formData.symbol ||
      !formData.metadataDigest
    ) {
      setCreateError("All fields are required");
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      // Parse initialConditions as array (comma-separated addresses)
      const initialConditionsArray = formData.initialConditions
        ? formData.initialConditions
            .split(",")
            .map((addr) => addr.trim())
            .filter((addr) => addr)
        : [];

      // Generate calldata
      const calldata = encodeFunctionData({
        abi: BASE_GROUP_FACTORY_ABI,
        functionName: "createBaseGroup",
        args: [
          formData.owner,
          formData.service,
          formData.feeCollection,
          initialConditionsArray,
          formData.name,
          formData.symbol,
          formData.metadataDigest,
        ],
      });

      console.log("=== Create Base Group Transaction ===");
      console.log("Contract Address:", BASE_GROUP_FACTORY_ADDRESS);
      console.log("Function:", "createBaseGroup");
      console.log("Parameters:", {
        owner: formData.owner,
        service: formData.service,
        feeCollection: formData.feeCollection,
        initialConditions: initialConditionsArray,
        name: formData.name,
        symbol: formData.symbol,
        metadataDigest: formData.metadataDigest,
      });
      console.log("Calldata:", calldata);
      console.log("====================================");

      // Prompt user to confirm execution
      const confirmExecution = window.confirm(
        `Ready to create Circles group!\n\n` +
          `Contract: ${BASE_GROUP_FACTORY_ADDRESS}\n` +
          `Function: createBaseGroup\n` +
          `Group Name: ${formData.name}\n` +
          `Symbol: ${formData.symbol}\n\n` +
          `Calldata has been logged to console.\n\n` +
          `Do you want to proceed with the transaction?`,
      );

      if (!confirmExecution) {
        setIsCreating(false);
        return;
      }

      // TODO: check EOA or SCW, check isMiniApp
      const result = await createBaseGroup({
        walletClient,
        owner: formData.owner,
        service: formData.service,
        feeCollection: formData.feeCollection,
        initialConditions: initialConditionsArray,
        name: formData.name,
        symbol: formData.symbol,
        metadataDigest: formData.metadataDigest,
      });

      console.log("Group created successfully!");
      console.log("Group Address:", result.groupAddress);
      console.log("Transaction Hash:", result.transactionHash);

      alert(
        `Group created successfully!\n\n` +
          `Group Address: ${result.groupAddress}\n` +
          `Transaction Hash: ${result.transactionHash}\n\n` +
          `Check console for full details.`,
      );

      // TODO: logic to createGroup in xmtp

      // const conversation = await client.conversations.createGroup(
      //   inboxIds, // members inbox ID (getInboxID by identifierID)
      //   options: {groupName: name,
      //   groupDescription: description,
      //   groupImageUrlSquare: imageUrlSquare,
      //   permissions: permissionsPolicy,
      //   customPermissionPolicySet:
      //     permissionsPolicy === GroupPermissionsOptions.CustomPolicy
      //       ? policySet
      //       : undefined,
      // },
      // );
      // TODO: store {result.groupAddress : conversation.id} pair in backend

      // Close modal and reset form
      setIsCreateModalOpen(false);
      setFormData({
        owner: "",
        service: "",
        feeCollection: "",
        initialConditions: "",
        name: "",
        symbol: "",
        metadataDigest: "",
      });

      // Refresh groups list
      // You might want to add a delay or wait for transaction confirmation
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error("Error creating group:", error);
      setCreateError(error.message || "Failed to create group");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="chatting-room-page">
      <div className="page-content">
        <div className="page-header">
          <h2>Circles Group</h2>
          <button
            className="create-group-btn"
            onClick={() => setIsCreateModalOpen(true)}>
            Create Circles Group
          </button>
        </div>

        {loading ? (
          <div className="placeholder-content">
            <p>Loading your groups...</p>
          </div>
        ) : error ? (
          <div className="placeholder-content">
            <p style={{ color: "#d32f2f" }}>{error}</p>
          </div>
        ) : !address ? (
          <div className="placeholder-content">
            <p>Please connect your wallet to view your groups</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="placeholder-content">
            <p>
              You haven't joined any Circles group, find more group to join
              [placeholder].
            </p>
          </div>
        ) : (
          <>
            <h3>Your Circles group(s)</h3>
            <div className="groups-list">
              {groups.map((group) => (
                <div key={group.address} className="group-item">
                  <div className="group-item-content">
                    <div className="group-name">{group.name}</div>
                    <div className="group-description">{group.description}</div>
                    <div className="group-membership-status">
                      Membership status:{" "}
                      <strong>{group.membershipStatus}</strong>
                    </div>
                    <div className="group-address">{group.address}</div>
                  </div>
                  <button
                    className="join-group-btn"
                    onClick={() => {
                      console.log("Join group chat");
                      alert("WIP");
                    }}>
                    Join Group Chat
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create Group Modal */}
      {isCreateModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setIsCreateModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Fill in Group details</h3>
              <button
                className="modal-close-btn"
                onClick={() => setIsCreateModalOpen(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {createError && (
                <div style={{ color: "#d32f2f", marginBottom: "1rem" }}>
                  {createError}
                </div>
              )}

              <label className="modal-label">Owner Address *</label>
              <input
                type="text"
                className="modal-input"
                name="owner"
                placeholder="0x..."
                value={formData.owner}
                onChange={handleFormChange}
                disabled={isCreating}
              />

              <label className="modal-label">Service Address *</label>
              <input
                type="text"
                className="modal-input"
                name="service"
                placeholder="0x..."
                value={formData.service}
                onChange={handleFormChange}
                disabled={isCreating}
              />

              <label className="modal-label">Fee Collection Address *</label>
              <input
                type="text"
                className="modal-input"
                name="feeCollection"
                placeholder="0x..."
                value={formData.feeCollection}
                onChange={handleFormChange}
                disabled={isCreating}
              />

              <label className="modal-label">
                Initial Conditions (comma-separated addresses)
              </label>
              <input
                type="text"
                className="modal-input"
                name="initialConditions"
                placeholder="0x..., 0x..."
                value={formData.initialConditions}
                onChange={handleFormChange}
                disabled={isCreating}
              />

              <label className="modal-label">Group Name *</label>
              <input
                type="text"
                className="modal-input"
                name="name"
                placeholder="My Circles Group"
                value={formData.name}
                onChange={handleFormChange}
                disabled={isCreating}
              />

              <label className="modal-label">Symbol *</label>
              <input
                type="text"
                className="modal-input"
                name="symbol"
                placeholder="MCG"
                value={formData.symbol}
                onChange={handleFormChange}
                disabled={isCreating}
              />

              <label className="modal-label">Metadata Digest (bytes32) *</label>
              <input
                type="text"
                className="modal-input"
                name="metadataDigest"
                placeholder="0x..."
                value={formData.metadataDigest}
                onChange={handleFormChange}
                disabled={isCreating}
              />
            </div>

            <div
              className="modal-footer"
              style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                className="modal-create-btn"
                onClick={handleCreateGroup}
                disabled={isCreating}>
                {isCreating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CirclesGroup;
