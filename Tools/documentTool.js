if (selectedTool === "document") {

    const retrievedDocs = await retriever.invoke(query);

    const context = retrievedDocs
        .map(doc => doc.pageContent)
        .join("\n\n");

    const answer = await chain.invoke({
        context,
        input: query,
    });

    return res.json({
        tool: "Document Search",
        answer,
        context: retrievedDocs.map(doc => doc.pageContent),
    });

}