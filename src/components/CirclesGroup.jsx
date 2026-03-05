import React, { useState, useEffect } from "react";
import { getGroupsInfo } from "../helpers/checkGroup";

function CirclesGroup({ address }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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

  return (
    <div className="chatting-room-page">
      <div className="page-content">
        <div className="page-header">
          <h2>Circles Group</h2>
          <button
            className="create-group-btn"
            onClick={() => setIsCreateModalOpen(true)}
          >
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
                      Membership status: <strong>{group.membershipStatus}</strong>
                    </div>
                    <div className="group-address">{group.address}</div>
                  </div>
                  <button
                    className="join-group-btn"
                    onClick={() => {
                      console.log("Join group chat");
                      alert("WIP");
                    }}
                  >
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
        <div className="modal-overlay" onClick={() => setIsCreateModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Fill in Group details</h3>
              <button
                className="modal-close-btn"
                onClick={() => setIsCreateModalOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>Group creation form coming soon...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CirclesGroup;
