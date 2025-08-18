import { mutall_error, view } from "../../../schema/v/code/schema.js";
//
// create and export savannah class.
// extend view to access the exec_php method from the view class and more
export class savannah extends view {
    //
    // the container element where images will be injected
    marketplace;
    //
    //
    client;
    //
    // keep track of the currently selected folder id for radio-driven switches
    current_folder_id;
    //
    // keep track of the current view mode (either "thumbnails" or "blob")
    view_mode = "thumbnails";
    //
    //
    constructor() {
        //
        // call super to initialize base view
        super();
        //
        // get the marketplace element
        this.marketplace = this.get_element("marketplace");
    }
    //
    // 
    async init() {
        //
        // create folder list items from the database
        await this.create_folder_list();
    }
    //
    // create an async method to list folders from database and render them
    async create_folder_list() {
        //
        // find the folders section using its class attribute
        const folder_section = document.querySelector(".folders");
        //
        // if the folders section is not found, throw an error
        if (!folder_section)
            throw new mutall_error("Folders section not found");
        //
        // create the <ul> element
        const ul = document.createElement("ul");
        //
        // fetch folders: folder, name, and id
        const folders = await this.exec_php("database", ["savannah", false], "get_sql_data", [
            `SELECT
                    folder.folder,
                    folder.name,
                    folder.id
                FROM
                    folder
                ORDER BY
                    CAST(SUBSTRING_INDEX(folder.name, '.', 1) AS UNSIGNED),
                    CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(folder.name, '.', 2), '.', -1) AS UNSIGNED),
                    CAST(SUBSTRING_INDEX(folder.name, '.', -1) AS UNSIGNED);`
        ]);
        //
        // loop through each folder record
        for (const folder of folders) {
            //
            // extract the folder id
            const folder_id = folder.id;
            //
            // crash if folder id is not a string
            if (typeof folder_id !== "string")
                throw new mutall_error("folder id is not a string");
            //
            // extract folder name
            const name = folder.name;
            //
            // throw an error if name is not a string
            if (typeof name !== "string")
                throw new mutall_error("name is not a string");
            //
            // create the <li> element
            const li = document.createElement("li");
            //
            // assign folder id as the id attribute
            li.id = folder_id;
            //
            // set text content to show folder pk and name
            li.textContent = `${name}`;
            //
            // add click listener to switch folder
            li.addEventListener("click", () => {
                //
                // Remove highlight class from any previously selected <li>
                const previously_selected = ul.querySelector(".selected");
                //
                // Remove the selection from the previously selected <li>
                if (previously_selected)
                    previously_selected.classList.remove("selected");
                //
                // Add highlight class to the clicked <li>
                li.classList.add("selected");
                //
                // Proceed with switching the folder
                this.switch_folder(folder_id);
            });
            //
            // append <li> to <ul>
            ul.appendChild(li);
        }
        //
        // append the <ul> to the folder section
        folder_section.appendChild(ul);
    }
    //
    //Get the blob of a file given the file id
    async get_blob(id) {
        //
        //Do a fetch to localhost: 3000 where the node js server is currently running
        const response = await fetch(`http://localhost:3000/file/${id}`);
        //
        //Ensure that the operation was successufll
        if (!response.ok)
            throw new mutall_error(`There was an issue ${response.statusText}`);
        //
        //Retrieve and return the blob from the response
        return response.blob();
    }
    //
    /**
     * @description Fetches the transcription for a given file ID from the backend.
     * @param {string} fileId The Google Drive file ID to transcribe.
     * @returns {Promise<string>} The transcribed text.
     */
    async transcribe(fileId) {
        //
        // Construct the URL to the transcription endpoint
        const url = `http://localhost:3000/transcribe/${fileId}`;
        //
        // Use the fetch API to make a GET request to the backend
        const response = await fetch(url);
        //
        // Check if the response was successful
        if (!response.ok) {
            throw new mutall_error(`Failed to transcribe image: ${response.statusText}`);
        }
        //
        // Parse the JSON response into our defined interface
        const data = await response.json();
        //
        // Return the transcription text
        return data.transcription;
    }
    async switch_view(mode) {
        //
        // update the current view mode
        this.view_mode = mode;
        //
        // if no folder has been selected, throw error
        if (!this.current_folder_id)
            throw new mutall_error("No folder selected.");
        //
        // let switch folder display the marketplace with the current view mode
        await this.switch_folder(this.current_folder_id);
    }
    //
    // switch the grid to show images for the selected folder
    async switch_folder(folder_id) {
        //
        // remember the current folder id so radios can use it later
        this.current_folder_id = folder_id;
        //
        // clear marketplace first
        this.marketplace.innerHTML = "";
        //
        // fetch thumbnails from backend
        const response = await fetch(`http://localhost:3000/thumbnails/${folder_id}`);
        //
        // handle error
        if (!response.ok)
            throw new mutall_error(`Failed to fetch thumbnails: ${response.statusText}`);
        //
        // parse JSON
        const thumbnails = await response.json();
        //
        // if view_mode is thumbnails, render using thumbnailUrl directly
        if (this.view_mode === "thumbnails") {
            //
            // loop thumbnails
            for (const thumb of thumbnails) {
                //
                // destructure fields
                const { id, name, thumbnailUrl } = thumb;
                //
                // create image element
                const img = document.createElement("img");
                //
                // set element id
                img.id = id;
                //
                // set alt text
                img.alt = name ?? "";
                //
                // use thumbnail url for fast initial load
                img.src = thumbnailUrl;
                //
                // on double click, show magnified blob
                img.ondblclick = async () => {
                    //
                    // fetch blob and magnify
                    const image_blob = await this.get_blob(id);
                    //
                    // Get the transcription
                    // The transcribe method will handle the fetch and error handling
                    const transcription = await this.transcribe(id);
                    //
                    //
                    this.magnify_window(image_blob, transcription);
                };
                //
                // add img to marketplace
                this.marketplace.appendChild(img);
            }
        }
        //
        // if view_mode is blob, fetch blobs first then render
        else if (this.view_mode === "blob") {
            //
            // loop through blobs
            for (const thumb of thumbnails) {
                //
                // destructure fields
                const { id, name, thumbnailUrl } = thumb;
                //
                // fetch blob using helper
                const blob = await this.get_blob(id);
                //
                // create object URL
                const blob_url = URL.createObjectURL(blob);
                //
                // create image element
                const img = document.createElement("img");
                //
                // set element id
                img.id = id;
                //
                // set alt text
                img.alt = name ?? "";
                //
                // set source to blob url
                img.src = blob_url;
                //
                // on double click, magnify blob
                img.ondblclick = async () => {
                    const image_blob = await this.get_blob(id);
                    // Get the transcription
                    // The transcribe method will handle the fetch and error handling
                    const transcription = await this.transcribe(id);
                    this.magnify_window(image_blob, transcription);
                };
                //
                // add img to marketplace
                this.marketplace.appendChild(img);
            }
        }
    }
    //
    // Opens a new window by fetching blob.html and injecting the blob uRL
    async magnify_window(image_blob, transcription) {
        //
        // Create a blob URL
        const blob_url = URL.createObjectURL(image_blob);
        //
        // Open the blob.html window first, to prevent blocking by popup blockers
        const win = window.open("", "_blank", "width=400,height=400");
        //
        // Ensure the window was successfully opened
        if (!win)
            throw new mutall_error("Failed to open blob viewer window.");
        //
        // Fetch the blob.html file as a template for displaying the image
        const response = await fetch("blob.html");
        //
        // If fetching blob.html fails, throw an error
        if (!response.ok) {
            throw new mutall_error(`failekd to fetch blob.html template. status: ${response.statusText}`);
        }
        //
        // Read the fetched HTML template as text
        const blob_html = await response.text();
        //
        // replace the place holder src with the actual blob URL
        const final_html = blob_html
            .replace("image_url", blob_url)
            .replace("transcription_placeholder", transcription);
        //
        // write the modified HTML into the newly opened window
        win.document.open();
        win.document.write(final_html);
        win.document.close();
        //
        // Revoke blob URL after load to prevent memory leaks
        // This prevents memory leaks from unused blob URLs
        win.onload = () => {
            URL.revokeObjectURL(blob_url);
        };
    }
}
