const { MilvusClient } = require("@zilliz/milvus2-sdk-node");

async function main() {
    const client = new MilvusClient("localhost:19530");
    try {
        const desc = await client.describeCollection({ collection_name: "teacher_profiles" });
        console.log("Schema:", JSON.stringify(desc.schema, null, 2));
        
        const pkField = desc.schema.fields.find(f => f.is_primary_key);
        console.log("PK Field:", pkField);

        // Test empty filter
        const resEmpty = await client.query({
            collection_name: "teacher_profiles",
            limit: 5,
            output_fields: ["*"],
            filter: ""
        });
        console.log("Empty Filter Result Count:", resEmpty.data ? resEmpty.data.length : 0);
        console.log("Empty Filter Status:", resEmpty.status);

    } catch (e) {
        console.error(e);
    } finally {
        await client.closeConnection();
    }
}

main();
