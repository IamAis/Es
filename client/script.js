const uploadForm = document.getElementById('upload-form');

uploadForm.addEventListener('submit', handleFileUpload);

function handleFileUpload(event) {
    event.preventDefault();
    
    const formData = new FormData(uploadForm);
    
    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Crea il link per il download
        const downloadLink = document.createElement('a');
        downloadLink.href = `/download/${data.htmlFile}`;
        downloadLink.download = data.htmlFile.replace('.html', '.pdf');
        downloadLink.textContent = 'Scarica PDF';
        downloadLink.className = 'download-button';
        
        // Aggiungi il link alla pagina
        const container = document.querySelector('.container');
        container.appendChild(downloadLink);
        
        alert('File elaborato con successo!');
    })
    .catch(error => {
        console.error('Errore:', error);
        alert('Errore durante l\'elaborazione del file');
    });
}