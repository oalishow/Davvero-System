const fs = require('fs');
let content = fs.readFileSync('src/components/AdminAppointments.tsx', 'utf8');

// I will find "sortedSeminaries.map" and re-construct the closing tags cleanly.
const target = `                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>`;

const replacement = `                      )
                    })}
                  </div>
                </div>
              )
            })}
                   </div>
                 </div>
               );
            })}
          </div>
        )}
      </div>`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/components/AdminAppointments.tsx', content);
    console.log("Fixed JSX");
} else {
    console.log("Not found target!");
}
