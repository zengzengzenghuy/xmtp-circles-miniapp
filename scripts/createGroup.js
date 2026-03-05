import { Client, GroupPermissionsOptions, PermissionPolicy } from "@xmtp/node-sdk";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { createInterface } from "readline";

// Create readline interface for user input
const readline = createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Promisify readline question
const question = (query) =>
  new Promise((resolve) => readline.question(query, resolve));

async function main() {
  console.log("=== XMTP Group Creation Script ===\n");

  try {
    // 1. Get private key from user
    console.log("⚠️  Warning: Never share your private key!");
    const privateKey = await question(
      "Enter your private key (with 0x prefix): "
    );

    if (!privateKey || !privateKey.startsWith("0x")) {
      throw new Error("Invalid private key format. Must start with 0x");
    }

    // 2. Create viem account and wallet client
    console.log("\n📝 Creating wallet from private key...");
    const account = privateKeyToAccount(privateKey);
    const walletClient = createWalletClient({
      account,
      chain: mainnet,
      transport: http(),
    });

    console.log(`✅ Wallet address: ${account.address}\n`);

    // 3. Create XMTP signer from viem account
    const signer = {
      getAddress: () => account.address,
      signMessage: async (message) => {
        const signature = await walletClient.signMessage({
          account,
          message:
            typeof message === "string" ? message : new TextDecoder().decode(message),
        });
        return signature;
      },
    };

    // 4. Get environment choice
    const envChoice = await question(
      'Select environment (1 for "dev", 2 for "production"): '
    );
    const env = envChoice.trim() === "2" ? "production" : "dev";
    console.log(`Using environment: ${env}\n`);

    // 5. Create XMTP client
    console.log("🔌 Connecting to XMTP network...");
    const client = await Client.create(signer, {
      env,
    });

    console.log(`✅ Connected! Inbox ID: ${client.inboxId}\n`);

    // 6. Sync conversations (important to avoid SequenceId error)
    console.log("🔄 Syncing conversations...");
    await client.conversations.sync();
    console.log("✅ Conversations synced\n");

    // 7. Get group name from user
    const groupName = await question("Enter group name: ");
    if (!groupName.trim()) {
      throw new Error("Group name cannot be empty");
    }

    // 8. Get admin address from user
    const adminAddress = await question(
      "Enter admin address (0x...): "
    );
    if (!adminAddress || !adminAddress.startsWith("0x")) {
      throw new Error("Invalid address format. Must start with 0x");
    }

    // 9. Fetch inbox ID for the admin address
    console.log("\n🔍 Fetching inbox ID for admin address...");
    const adminInboxId = await client.getInboxIdByAddress(adminAddress);

    if (!adminInboxId) {
      throw new Error(
        "Admin address is not registered on the XMTP network. The address must have an XMTP inbox."
      );
    }

    console.log(`✅ Found inbox ID: ${adminInboxId}\n`);

    // 10. Verify the inbox ID exists on the network
    console.log("🔍 Verifying inbox ID on network...");
    const canMessage = await client.canMessage([adminInboxId]);
    if (!canMessage) {
      throw new Error("Admin inbox ID not found on network");
    }
    console.log("✅ Inbox ID verified\n");

    // 11. Create group with custom permissions
    console.log("🏗️  Creating group...");
    const group = await client.conversations.createGroup(
      [adminInboxId], // Add admin as initial member
      {
        groupName: groupName,
        permissions: GroupPermissionsOptions.CustomPolicy,
        customPermissionPolicySet: {
          addMemberPolicy: PermissionPolicy.Allow, // Anyone can add members (join)
          removeMemberPolicy: PermissionPolicy.Allow, // Anyone can remove members (leave)
          addAdminPolicy: PermissionPolicy.SuperAdmin,
          removeAdminPolicy: PermissionPolicy.SuperAdmin,
          updateGroupNamePolicy: PermissionPolicy.Admin,
          updateGroupDescriptionPolicy: PermissionPolicy.Admin,
          updateGroupImageUrlSquarePolicy: PermissionPolicy.Admin,
          updateMessageDisappearingPolicy: PermissionPolicy.Admin,
          updateAppDataPolicy: PermissionPolicy.Allow,
        },
      }
    );

    console.log("✅ Group created!\n");

    // 12. Sync group
    console.log("🔄 Syncing group...");
    await group.sync();
    console.log("✅ Group synced\n");

    // 13. Promote admin
    console.log("👤 Adding admin...");
    await group.addAdmin(adminInboxId);
    console.log("✅ Admin added\n");

    // 14. Get and display group metadata
    console.log("📊 Group Metadata:");
    console.log("─".repeat(50));
    console.log(`Group ID:           ${group.id}`);
    console.log(`Group Name:         ${groupName}`);
    console.log(`Creator Inbox ID:   ${client.inboxId}`);
    console.log(`Creator Address:    ${account.address}`);
    console.log(`Admin Address:      ${adminAddress}`);
    console.log(`Admin Inbox ID:     ${adminInboxId}`);
    console.log(`Super Admins:       ${group.superAdmins.join(", ")}`);
    console.log(`Admins:             ${group.admins.join(", ")}`);
    console.log("─".repeat(50));

    console.log("\n✅ Group creation completed successfully!");
    console.log(
      "\nℹ️  Note: Anyone can join or leave this group due to the custom permissions."
    );
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error("\nFull error:", error);
    process.exit(1);
  } finally {
    readline.close();
  }
}

// Run the script
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
